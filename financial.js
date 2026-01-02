const express = require('express');
const Subscription = require('../models/Subscription');
const Expense = require('../models/Expense');
const Student = require('../models/Student');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/financial/summary
// @desc    Get financial summary (income, expenses, profit)
// @access  Private (Director, Supervisor, Student Affairs)
router.get('/summary', protect, authorize('director', 'supervisor', 'student_affairs', 'admin'), async (req, res) => {
    try {
        const { year, month } = req.query;
        const currentYear = parseInt(year) || new Date().getFullYear();
        const currentMonth = parseInt(month) || new Date().getMonth() + 1;

        // Get subscription income
        const subscriptions = await Subscription.aggregate([
            {
                $match: {
                    year: currentYear,
                    monthNumber: currentMonth
                }
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

        // Calculate totals
        let totalExpectedIncome = 0;
        let totalPaidIncome = 0;
        let paidCount = 0;
        let pendingCount = 0;
        let exemptCount = 0;

        subscriptions.forEach(sub => {
            totalExpectedIncome += sub.totalAmount;
            if (sub._id === 'مدفوع') {
                totalPaidIncome += sub.paidAmount;
                paidCount = sub.count;
            } else if (sub._id === 'متأخر') {
                pendingCount = sub.count;
            } else if (sub._id === 'معفي') {
                exemptCount = sub.count;
            }
        });

        // Get expenses
        const startDate = new Date(currentYear, currentMonth - 1, 1);
        const endDate = new Date(currentYear, currentMonth, 0);

        const expenses = await Expense.aggregate([
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

        const totalExpenses = expenses.reduce((sum, exp) => sum + exp.total, 0);

        // Calculate profit
        const netProfit = totalPaidIncome - totalExpenses;

        res.json({
            success: true,
            summary: {
                period: {
                    year: currentYear,
                    month: currentMonth
                },
                income: {
                    expected: totalExpectedIncome,
                    paid: totalPaidIncome,
                    pending: totalExpectedIncome - totalPaidIncome
                },
                subscriptions: {
                    paid: paidCount,
                    pending: pendingCount,
                    exempt: exemptCount,
                    total: paidCount + pendingCount + exemptCount
                },
                expenses: {
                    total: totalExpenses,
                    breakdown: expenses
                },
                netProfit
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'حدث خطأ في الخادم' });
    }
});

// @route   GET /api/financial/subscriptions
// @desc    Get subscriptions
// @access  Private
router.get('/subscriptions', protect, async (req, res) => {
    try {
        const { year, month, status } = req.query;
        const query = {};

        if (year) query.year = parseInt(year);
        if (month) query.monthNumber = parseInt(month);
        if (status) query.status = status;

        const subscriptions = await Subscription.find(query)
            .populate('student', 'name stage')
            .sort({ createdAt: -1 });

        res.json({
            success: true,
            count: subscriptions.length,
            subscriptions
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'حدث خطأ في الخادم' });
    }
});

// @route   POST /api/financial/subscriptions
// @desc    Create subscription
// @access  Private (student_affairs)
router.post('/subscriptions', protect, authorize('student_affairs', 'director', 'admin', 'supervisor'), async (req, res) => {
    try {
        const { student, year, monthNumber, status, amount, paidAmount, exemptionReason } = req.body;

        const subscription = await Subscription.create({
            student,
            year,
            monthNumber,
            month: new Date(year, monthNumber - 1, 1),
            status,
            amount: amount || 100,
            paidAmount: status === 'مدفوع' ? (paidAmount || amount || 100) : (paidAmount || 0),
            paidAt: status === 'مدفوع' ? new Date() : null,
            exemptionReason
        });

        const populatedSubscription = await Subscription.findById(subscription._id)
            .populate('student', 'name');

        res.status(201).json({
            success: true,
            subscription: populatedSubscription
        });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({ message: 'الاشتراك موجود بالفعل لهذا الشهر' });
        }
        console.error(error);
        res.status(500).json({ message: 'حدث خطأ في الخادم' });
    }
});

// @route   PUT /api/financial/subscriptions/:id
// @desc    Update subscription
// @access  Private (student_affairs, director, admin)
router.put('/subscriptions/:id', protect, authorize('student_affairs', 'director', 'admin', 'supervisor'), async (req, res) => {
    try {
        const { status, paidAmount, exemptionReason, notes } = req.body;
        const updateData = { status, paidAmount, exemptionReason, notes };

        if (status === 'مدفوع') {
            updateData.paidAt = new Date();
        }

        const subscription = await Subscription.findByIdAndUpdate(
            req.params.id,
            updateData,
            { new: true }
        ).populate('student', 'name');

        if (!subscription) {
            return res.status(404).json({ message: 'الاشتراك غير موجود' });
        }

        res.json({ success: true, subscription });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'حدث خطأ في الخادم' });
    }
});

// @route   GET /api/financial/expenses
// @desc    Get expenses
// @access  Private (Director, Supervisor, Student Affairs)
router.get('/expenses', protect, authorize('director', 'supervisor', 'student_affairs', 'admin'), async (req, res) => {
    try {
        const { year, month, type } = req.query;
        const query = {};

        if (year && month) {
            const startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
            const endDate = new Date(parseInt(year), parseInt(month), 0);
            query.date = { $gte: startDate, $lte: endDate };
        }

        if (type) query.type = type;

        const expenses = await Expense.find(query)
            .populate('createdBy', 'name')
            .sort({ date: -1 });

        res.json({
            success: true,
            count: expenses.length,
            expenses
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'حدث خطأ في الخادم' });
    }
});

// @route   POST /api/financial/expenses
// @desc    Create expense
// @access  Private (Director, Supervisor, Student Affairs, Admin)
router.post('/expenses', protect, authorize('director', 'supervisor', 'student_affairs', 'admin'), async (req, res) => {
    try {
        const { type, description, amount, date, paidTo, notes } = req.body;

        const expense = await Expense.create({
            type,
            description,
            amount,
            date: date || new Date(),
            paidTo,
            notes,
            createdBy: req.user._id
        });

        res.status(201).json({
            success: true,
            expense
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'حدث خطأ في الخادم' });
    }
});

// @route   POST /api/financial/generate-monthly
// @desc    Generate monthly subscriptions for all active students
// @access  Private (student_affairs, director)
router.post('/generate-monthly', protect, authorize('student_affairs', 'director'), async (req, res) => {
    try {
        const { year, month } = req.body;

        // Get all active students
        const students = await Student.find({ status: 'منتظم' });

        // Create subscriptions for each student
        const subscriptions = [];
        for (const student of students) {
            try {
                const subscription = await Subscription.create({
                    student: student._id,
                    year,
                    monthNumber: month,
                    month: new Date(year, month - 1, 1),
                    status: 'متأخر',
                    amount: 100,
                    paidAmount: 0
                });
                subscriptions.push(subscription);
            } catch (err) {
                // Skip if subscription already exists
                if (err.code !== 11000) throw err;
            }
        }

        res.status(201).json({
            success: true,
            message: `تم إنشاء ${subscriptions.length} اشتراك`,
            count: subscriptions.length
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'حدث خطأ في الخادم' });
    }
});

module.exports = router;
