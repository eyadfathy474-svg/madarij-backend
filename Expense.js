const mongoose = require('mongoose');

const expenseSchema = new mongoose.Schema({
    type: {
        type: String,
        enum: ['إيجار', 'معلمين', 'كهرباء', 'مياه', 'صيانة', 'مستلزمات', 'أخرى'],
        required: [true, 'نوع المصروف مطلوب']
    },
    description: {
        type: String,
        trim: true
    },
    amount: {
        type: Number,
        required: [true, 'المبلغ مطلوب'],
        min: 0
    },
    date: {
        type: Date,
        required: [true, 'التاريخ مطلوب'],
        default: Date.now
    },
    paidTo: {
        type: String,
        trim: true
    },
    isPaid: {
        type: Boolean,
        default: true
    },
    receipt: {
        type: String
    },
    notes: {
        type: String,
        trim: true
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
}, {
    timestamps: true
});

// Index for date queries
expenseSchema.index({ date: -1 });

// Static method to get monthly expenses
expenseSchema.statics.getMonthlyExpenses = async function (year, month) {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    return this.aggregate([
        {
            $match: {
                date: { $gte: startDate, $lte: endDate }
            }
        },
        {
            $group: {
                _id: '$type',
                total: { $sum: '$amount' }
            }
        }
    ]);
};

module.exports = mongoose.model('Expense', expenseSchema);
