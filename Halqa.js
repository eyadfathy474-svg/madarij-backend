const mongoose = require('mongoose');

const halqaSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'اسم الحلقة مطلوب'],
        trim: true
    },
    classroom: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Classroom',
        required: [true, 'الفصل مطلوب']
    },
    teacher: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'المعلم مطلوب']
    },
    supervisor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'المشرف مطلوب']
    },
    days: [{
        type: String,
        enum: ['السبت', 'الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة']
    }],
    startTime: {
        type: String,
        default: '14:00'
    },
    endTime: {
        type: String,
        default: '16:00'
    },
    sessionDuration: {
        type: Number,
        default: 120 // minutes
    },
    maxStudents: {
        type: Number,
        default: 15
    },
    isActive: {
        type: Boolean,
        default: true
    },
    description: {
        type: String,
        trim: true
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Virtual for student count
halqaSchema.virtual('students', {
    ref: 'Student',
    localField: '_id',
    foreignField: 'halqa'
});

module.exports = mongoose.model('Halqa', halqaSchema);
