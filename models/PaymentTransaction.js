const mongoose = require('mongoose');

const PaymentTransactionSchema = new mongoose.Schema(
  {
    orderId: {
      type: String,
      require: true,
      index: true,
    },
    provider: {
      type: String,
      enum: ['vnpay, paypal'],
      require: true,
    },
    transactionId: {
      type: String, // vnp_TxnRef / paypal orderId
      // required: false,
      unique: true,
      sparse: true,
      // default: null,
    },

    amount: {
      type: Number,
      required: true,
    },

    currency: {
      type: String,
      default: 'VND',
    },

    status: {
      type: String,
      enum: ['pending', 'paid', 'failed'],
      default: 'pending',
    },

    rawResponse: {
      type: Object, // lưu callback/query gốc từ VNPay / PayPal
    },

    paidAt: {
      type: Date,
    },
  },
  {
    timestamps: true, // createdAt, updatedAt
  },
);

module.exports = mongoose.model('PaymentTransaction', PaymentTransactionSchema);
