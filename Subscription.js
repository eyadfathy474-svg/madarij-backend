const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema({
    student: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Student',
        required: [true, 'الطالب مطلوب']
    },
    month: {
        type: Date,
        required: [true, 'الشهر مطلوب']
    },
    year: {
        type: Number,
        required: true
    },
    monthNumber: {
        type: Number,
        required: true,
        min: 1,
        max: 12
    },
    status: {
        type: String,
        enum: ['مدفوع', 'متأخر', 'معفي', 'جزئي'],
        default: 'متأخر'
    },
    amount: {
        type: Number,
        default: 100
    },
    paidAmount: {
        type: Number,
        default: 0
    },
    paidAt: {
        type: Date
    },
    exemptionReason: {
        type: String,
        trim: true
    },
    notes: {
        type: String,
        trim: true
    }
}, {
    timestamps: true
});

// Compound unique index for student and month
subscriptionSchema.index({ student: 1, year: 1, monthNumber: 1 }, { unique: true });

// Static method to get subscription stats
subscriptionSchema.statics.getMonthlyStats = async function (year, month) {
    return this.aggregate([
        {
            $match: { year, monthNumber: month }
        },
        {
            $group: {
                _id: '$status',
                count: { $sum: 1 },
                totalAmount: { $sum: '$amount' },
                paidAmount: { $sum: '$paidAmount' }
            }
        }
    ]);
};

module.exports = mongoose.model('Subscription', subscriptionSchema);
