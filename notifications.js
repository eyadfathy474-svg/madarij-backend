const express = require('express');
const Notification = require('../models/Notification');
const { protect } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/notifications
// @desc    Get user notifications
// @access  Private
router.get('/', protect, async (req, res) => {
    try {
        const { unreadOnly, limit = 20 } = req.query;

        const query = { recipient: req.user._id };
        if (unreadOnly === 'true') {
            query.isRead = false;
        }

        const notifications = await Notification.find(query)
            .sort({ createdAt: -1 })
            .limit(parseInt(limit))
            .populate('relatedStudent', 'name')
            .populate('relatedInterview');

        const unreadCount = await Notification.getUnreadCount(req.user._id);

        res.json({
            success: true,
            count: notifications.length,
            unreadCount,
            notifications
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'حدث خطأ في الخادم' });
    }
});

// @route   GET /api/notifications/unread-count
// @desc    Get unread notification count
// @access  Private
router.get('/unread-count', protect, async (req, res) => {
    try {
        const count = await Notification.getUnreadCount(req.user._id);

        res.json({
            success: true,
            count
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'حدث خطأ في الخادم' });
    }
});

// @route   PUT /api/notifications/:id/read
// @desc    Mark notification as read
// @access  Private
router.put('/:id/read', protect, async (req, res) => {
    try {
        const notification = await Notification.findOne({
            _id: req.params.id,
            recipient: req.user._id
        });

        if (!notification) {
            return res.status(404).json({ message: 'الإشعار غير موجود' });
        }

        await notification.markAsRead();

        res.json({
            success: true,
            message: 'تم تحديث الإشعار',
            notification
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'حدث خطأ في الخادم' });
    }
});

// @route   PUT /api/notifications/read-all
// @desc    Mark all notifications as read
// @access  Private
router.put('/read-all', protect, async (req, res) => {
    try {
        await Notification.updateMany(
            { recipient: req.user._id, isRead: false },
            { isRead: true, readAt: new Date() }
        );

        res.json({
            success: true,
            message: 'تم تحديث جميع الإشعارات'
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'حدث خطأ في الخادم' });
    }
});

// @route   DELETE /api/notifications/:id
// @desc    Delete a notification
// @access  Private
router.delete('/:id', protect, async (req, res) => {
    try {
        const notification = await Notification.findOneAndDelete({
            _id: req.params.id,
            recipient: req.user._id
        });

        if (!notification) {
            return res.status(404).json({ message: 'الإشعار غير موجود' });
        }

        res.json({
            success: true,
            message: 'تم حذف الإشعار'
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'حدث خطأ في الخادم' });
    }
});

module.exports = router;
