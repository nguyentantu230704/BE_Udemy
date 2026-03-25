const request = require('supertest');

process.env.JWT_SECRET = 'test-secret';
process.env.CLIENT_URL = 'http://localhost:3000';

const mockSendEmail = jest.fn().mockResolvedValue();
const mockGenerateToken = jest.fn(() => 'mock-token');
const mockJwtVerify = jest.fn(() => ({ id: 'user-1' }));
const mockBcryptCompare = jest.fn();

const mockUserModel = jest.fn().mockImplementation(function User(data = {}) {
  Object.assign(this, data);
  this._id = this._id || 'new-user-id';
  this.role = this.role || 'student';
  this.getVerificationToken = jest.fn(() => 'verify-token');
  this.getResetPasswordToken = jest.fn(() => 'reset-token');
  this.save = jest.fn().mockResolvedValue(this);
});
mockUserModel.findOne = jest.fn();
mockUserModel.findById = jest.fn();
mockUserModel.findByIdAndDelete = jest.fn();
mockUserModel.findByIdAndUpdate = jest.fn();
mockUserModel.updateMany = jest.fn();

const mockCourseModel = {
  find: jest.fn(),
  findOne: jest.fn(),
  findById: jest.fn(),
  updateMany: jest.fn(),
};

const mockCourseProgressModel = jest.fn().mockImplementation(function CourseProgress(data = {}) {
  Object.assign(this, {
    completedLessons: [],
    isCompleted: false,
    certificateId: undefined,
    completedAt: undefined,
    ...data,
  });
  this.save = jest.fn().mockResolvedValue(this);
});
mockCourseProgressModel.findOne = jest.fn();
mockCourseProgressModel.create = jest.fn();

const mockCouponModel = {
  findOne: jest.fn(),
};

jest.mock('./config/db', () => jest.fn());
jest.mock('./utils/sendEmail', () => mockSendEmail);
jest.mock('./utils/generateToken', () => mockGenerateToken);
jest.mock('jsonwebtoken', () => ({
  verify: (...args) => mockJwtVerify(...args),
  sign: jest.fn(() => 'signed-token'),
}));
jest.mock('bcryptjs', () => ({
  genSalt: jest.fn().mockResolvedValue('salt'),
  hash: jest.fn().mockResolvedValue('hashed-password'),
  compare: (...args) => mockBcryptCompare(...args),
}));
jest.mock('./models/User', () => mockUserModel);
jest.mock('./models/Course', () => mockCourseModel);
jest.mock('./models/CourseProgress', () => mockCourseProgressModel);
jest.mock('./models/Coupon', () => mockCouponModel);
jest.mock('./models/PaymentTransaction', () => ({
  findOne: jest.fn(),
  findById: jest.fn(),
  create: jest.fn(),
}));
jest.mock('./config/cloudinary', () => ({
  upload: {
    single: () => (req, res, next) => next(),
  },
  cloudinary: {
    uploader: {
      destroy: jest.fn(),
    },
  },
}));
jest.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: jest.fn(() => ({
    getGenerativeModel: jest.fn(() => ({
      generateContent: jest.fn(),
    })),
  })),
}));
jest.mock('google-auth-library', () => ({
  OAuth2Client: jest.fn(() => ({
    verifyIdToken: jest.fn(),
  })),
}));
jest.mock('./service/paymentService', () => ({
  createPayment: jest.fn(),
  verifyPayment: jest.fn(),
}));

const paymentService = require('./service/paymentService');
const { app } = require('./server');

const createListQuery = (result) => {
  const chain = {
    populate: jest.fn(() => chain),
    select: jest.fn(() => chain),
    sort: jest.fn().mockResolvedValue(result),
  };

  return chain;
};

const createPopulateTwiceQuery = (result) => {
  const chain = {
    populate: jest
      .fn()
      .mockImplementationOnce(() => chain)
      .mockImplementationOnce(() => Promise.resolve(result)),
  };

  return chain;
};

const createCourseDetailQuery = (result) => {
  const chain = {
    populate: jest
      .fn()
      .mockImplementationOnce(() => chain)
      .mockImplementationOnce(() => chain)
      .mockImplementationOnce(() => Promise.resolve(result)),
  };

  return chain;
};

const setAuthorizedUser = (user = { _id: 'user-1', role: 'student', enrolledCourses: [], cart: [] }) => {
  mockUserModel.findById.mockReturnValue({
    select: jest.fn().mockResolvedValue(user),
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  setAuthorizedUser();
  mockBcryptCompare.mockResolvedValue(true);
  mockJwtVerify.mockReturnValue({ id: 'user-1' });
  mockSendEmail.mockResolvedValue();
  mockGenerateToken.mockReturnValue('mock-token');
});

describe('Auth API', () => {
  test('TC01 - Register success', async () => {
    mockUserModel.findOne.mockResolvedValue(null);

    const res = await request(app).post('/api/auth/register').send({
      name: 'Test User',
      email: 'test@gmail.com',
      password: '123456',
    });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(mockSendEmail).toHaveBeenCalledTimes(1);
    expect(mockUserModel).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Test User',
        email: 'test@gmail.com',
        role: 'student',
      })
    );
  });

  test('TC02 - Register duplicate email', async () => {
    mockUserModel.findOne.mockResolvedValue({ _id: 'existing-user' });

    const res = await request(app).post('/api/auth/register').send({
      name: 'Test User',
      email: 'test@gmail.com',
      password: '123456',
    });

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBeDefined();
  });

  test('TC03 - Login success', async () => {
    mockUserModel.findOne.mockResolvedValue({
      _id: 'user-1',
      name: 'Test User',
      email: 'test@gmail.com',
      password: 'hashed-password',
      role: 'student',
      avatar: '',
      isVerified: true,
    });

    const res = await request(app).post('/api/auth/login').send({
      email: 'test@gmail.com',
      password: '123456',
    });

    expect(res.statusCode).toBe(200);
    expect(res.body.token).toBe('mock-token');
    expect(res.body.email).toBe('test@gmail.com');
  });

  test('TC04 - Login wrong password', async () => {
    mockBcryptCompare.mockResolvedValue(false);
    mockUserModel.findOne.mockResolvedValue({
      email: 'test@gmail.com',
      password: 'hashed-password',
      isVerified: true,
    });

    const res = await request(app).post('/api/auth/login').send({
      email: 'test@gmail.com',
      password: 'wrong',
    });

    expect(res.statusCode).toBe(401);
  });

  test('TC05 - Forgot password', async () => {
    const user = {
      email: 'test@gmail.com',
      getResetPasswordToken: jest.fn(() => 'reset-token'),
      save: jest.fn().mockResolvedValue(true),
    };

    mockUserModel.findOne.mockResolvedValue(user);

    const res = await request(app).post('/api/auth/forgotpassword').send({
      email: 'test@gmail.com',
    });

    expect(res.statusCode).toBe(200);
    expect(mockSendEmail).toHaveBeenCalled();
  });
});

describe('Course API', () => {
  test('TC06 - Get course list', async () => {
    const courses = [{ _id: 'course-1', title: 'Node.js' }];
    mockCourseModel.find.mockReturnValue(createListQuery(courses));

    const res = await request(app).get('/api/courses');

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual(courses);
  });

  test('TC07 - Search course', async () => {
    mockCourseModel.find.mockReturnValue(createListQuery([]));

    const res = await request(app).get('/api/courses').query({ keyword: 'Node' });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('TC08 - Get course detail', async () => {
    mockCourseModel.findOne.mockReturnValue(
      createCourseDetailQuery({
        toObject: () => ({
          _id: 'course-1',
          title: 'Node.js',
          slug: 'course-1',
          sections: [],
        }),
      })
    );

    const res = await request(app).get('/api/courses/course-1');

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.title).toBe('Node.js');
  });

  test('TC09 - Get course detail not found', async () => {
    mockCourseModel.findOne.mockReturnValue(createCourseDetailQuery(null));

    const res = await request(app).get('/api/courses/not-found');

    expect(res.statusCode).toBe(404);
  });
});

describe('Payment API', () => {
  test('TC10 - Create payment', async () => {
    mockCourseModel.find.mockResolvedValue([{ _id: 'course-1', price: 100000 }]);

    paymentService.createPayment.mockResolvedValue({
      success: true,
      redirectUrl: 'https://pay.example',
    });

    const res = await request(app)
      .post('/api/payment/create_payment_url')
      .set('Authorization', 'Bearer fake-token')
      .send({
        method: 'vnpay',
        items: ['course-1'],
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.redirectUrl).toBeDefined();
  });

  test('TC11 - Payment fail', async () => {
    mockCourseModel.find.mockResolvedValue([]);
    paymentService.createPayment.mockRejectedValue(new Error('fail'));

    const res = await request(app)
      .post('/api/payment/create_payment_url')
      .set('Authorization', 'Bearer fake-token')
      .send({
        method: 'vnpay',
        items: [],
      });

    expect(res.statusCode).toBeGreaterThanOrEqual(400);
  });
});

describe('Learning API', () => {
  test('TC12 - Get progress', async () => {
    mockCourseProgressModel.findOne.mockResolvedValue(null);
    mockCourseProgressModel.create.mockResolvedValue({
      course: 'course-1',
    });

    const res = await request(app)
      .get('/api/progress/course-1')
      .set('Authorization', 'Bearer fake-token');

    expect(res.statusCode).toBe(200);
  });

  test('TC13 - Mark complete', async () => {
    mockCourseProgressModel.findOne.mockResolvedValue(null);
    mockCourseModel.findById.mockReturnValue({
      populate: jest.fn().mockResolvedValue({
        sections: [{ lessons: ['lesson-1'] }],
      }),
    });

    const res = await request(app)
      .post('/api/progress/mark-completed')
      .set('Authorization', 'Bearer fake-token')
      .send({
        courseId: 'course-1',
        lessonId: 'lesson-1',
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.isCompleted).toBe(true);
  });

  test('TC14 - Get certificate', async () => {
    mockCourseProgressModel.findOne.mockReturnValue(
      createPopulateTwiceQuery({
        isCompleted: true,
        certificateId: 'CERT-ABC',
        user: { name: 'Test User' },
        course: { title: 'Node.js' },
      })
    );

    const res = await request(app).get('/api/progress/certificate/CERT-ABC');

    expect(res.statusCode).toBe(200);
  });
});

describe('Misc API', () => {
  beforeEach(() => {
    mockCourseModel.find.mockReset();
  });

  test('GET / returns server health text', async () => {
    const res = await request(app).get('/');

    expect(res.statusCode).toBe(200);
    expect(res.text).toBe('API is running...');
  });
});
