const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'اسم الطالب مطلوب'],
        trim: true
    },
    age: {
        type: Number,
        min: 4,
        max: 30
    },
    dateOfBirth: {
        type: Date
    },
    stage: {
        type: String,
        enum: ['ابتدائي', 'إعدادي', 'ثانوي', 'جامعة'],
        required: [true, 'المرحلة الدراسية مطلوبة']
    },
    halqa: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Halqa'
    },
    guardian: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Guardian',
        required: [true, 'ولي الأمر مطلوب']
    },
    status: {
        type: String,
        enum: ['منتظم', 'منقطع', 'متوقف'],
        default: 'منتظم'
    },
    enrollmentDate: {
        type: Date,
        default: Date.now
    },
    currentJuz: {
        type: Number,
        min: 1,
        max: 30,
        default: 1
    },
    currentSurah: {
        type: String,
        default: 'الفاتحة'
    },
    totalMemorized: {
        type: String,
        default: '0 صفحات'
    },
    notes: {
        type: String,
        trim: true
    },
    photo: {
        type: String
    },
    // Application/Onboarding Status
    applicationStatus: {
        type: String,
        enum: ['New', 'FormGiven', 'FormSubmitted', 'InterviewScheduled', 'InterviewCompleted', 'Accepted', 'Rejected', 'Pending'],
        default: 'New'
    },
    interviewDate: {
        type: Date
    },
    interviewNotes: {
        type: String,
        trim: true
    },
    isActive: {
        type: Boolean,
        default: false
    },
    acceptedAt: {
        type: Date
    },
    acceptedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
}, {
    timestamps: true
});

// Index for efficient queries
studentSchema.index({ halqa: 1, status: 1 });
studentSchema.index({ applicationStatus: 1 });
studentSchema.index({ isActive: 1 });

// Virtual to check if student is fully enrolled
studentSchema.virtual('isEnrolled').get(function () {
    return this.applicationStatus === 'Accepted' && this.isActive && this.halqa;
});

module.exports = mongoose.model('Student', studentSchema);
