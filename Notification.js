const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    recipient: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'المستلم مطلوب']
    },
    type: {
        type: String,
        enum: ['interview_scheduled', 'interview_reminder', 'student_accepted', 'student_rejected', 'attendance_alert', 'system'],
        required: true
    },
    title: {
        type: String,
        required: [true, 'عنوان الإشعار مطلوب'],
        trim: true
    },
    message: {
        type: String,
        required: [true, 'محتوى الإشعار مطلوب'],
        trim: true
    },
    relatedStudent: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Student'
    },
    relatedInterview: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Interview'
    },
    isRead: {
        type: Boolean,
        default: false
    },
    readAt: {
        type: Date
    },
    priority: {
        type: String,
        enum: ['low', 'medium', 'high'],
        default: 'medium'
    },
    expiresAt: {
        type: Date
    }
}, {
    timestamps: true
});

// Index for efficient queries
notificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ type: 1 });

// Static method to create interview notification
notificationSchema.statics.createInterviewNotification = async function (recipientId, studentName, interviewDate, interviewId) {
    const formattedDate = new Date(interviewDate).toLocaleDateString('ar-EG', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    return this.create({
        recipient: recipientId,
        type: 'interview_scheduled',
        title: 'مقابلة جديدة مجدولة',
        message: `تم جدولة مقابلة للطالب ${studentName} في ${formattedDate} بعد صلاة العصر`,
        relatedInterview: interviewId,
        priority: 'high'
    });
};

// Static method to get unread count
notificationSchema.statics.getUnreadCount = async function (userId) {
    return this.countDocuments({ recipient: userId, isRead: false });
};

// Method to mark as read
notificationSchema.methods.markAsRead = function () {
    this.isRead = true;
    this.readAt = new Date();
    return this.save();
};

module.exports = mongoose.model('Notification', notificationSchema);
