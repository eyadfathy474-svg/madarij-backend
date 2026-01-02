const mongoose = require('mongoose');

const communicationLogSchema = new mongoose.Schema({
    student: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Student',
        required: [true, 'الطالب مطلوب']
    },
    guardian: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Guardian',
        required: [true, 'ولي الأمر مطلوب']
    },
    initiatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'المستخدم مطلوب']
    },
    communicationType: {
        type: String,
        enum: ['whatsapp', 'phone', 'in_person', 'other'],
        default: 'whatsapp'
    },
    purpose: {
        type: String,
        enum: ['attendance', 'performance', 'general', 'emergency', 'interview', 'subscription'],
        default: 'general'
    },
    session: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Session'
    },
    notes: {
        type: String,
        trim: true
    }
    // Note: We intentionally do NOT store message content for privacy
}, {
    timestamps: true
});

// Index for efficient queries
communicationLogSchema.index({ student: 1, createdAt: -1 });
communicationLogSchema.index({ guardian: 1, createdAt: -1 });
communicationLogSchema.index({ initiatedBy: 1, createdAt: -1 });

// Static method to get communication history for a student
communicationLogSchema.statics.getStudentHistory = async function (studentId, limit = 10) {
    return this.find({ student: studentId })
        .sort({ createdAt: -1 })
        .limit(limit)
        .populate('initiatedBy', 'name')
        .populate('guardian', 'name phone');
};

// Static method to get today's communications by user
communicationLogSchema.statics.getTodaysByUser = async function (userId) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return this.find({
        initiatedBy: userId,
        createdAt: { $gte: today, $lt: tomorrow }
    }).populate('student', 'name').populate('guardian', 'name');
};

module.exports = mongoose.model('CommunicationLog', communicationLogSchema);
