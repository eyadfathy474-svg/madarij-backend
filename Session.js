const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
    halqa: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Halqa',
        required: [true, 'الحلقة مطلوبة']
    },
    date: {
        type: Date,
        required: [true, 'التاريخ مطلوب'],
        default: Date.now
    },
    dayType: {
        type: String,
        enum: ['عادي', 'جمعة'],
        default: 'عادي'
    },
    status: {
        type: String,
        enum: ['لم تبدأ', 'بدأت', 'انتهت'],
        default: 'لم تبدأ'
    },
    // Direct references for session (copied from halqa for session-specific tracking)
    teacher: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    supervisor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    studentAffairs: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    classroom: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Classroom'
    },
    timeStart: {
        type: String
    },
    timeEnd: {
        type: String
    },
    stages: {
        teacherReading: {
            type: Boolean,
            default: false
        },
        studentReading: {
            type: Boolean,
            default: false
        },
        tafseer: {
            type: Boolean,
            default: false
        },
        tasmeea: {
            type: Boolean,
            default: false
        }
    },
    fridayActivity: {
        type: String,
        enum: ['تربوي', 'ترفيهي', null],
        default: null
    },
    fridayStage: {
        type: String,
        enum: ['ابتدائي', 'إعدادي', 'ثانوي', 'جامعة', null],
        default: null
    },
    // Friday management
    isRecreationalDay: {
        type: Boolean,
        default: false
    },
    recreationalDaySetAt: {
        type: Date
    },
    fridayEducationalLevel: {
        type: String,
        enum: ['ابتدائي', 'إعدادي', 'ثانوي', 'جامعة', null],
        default: null
    },
    notes: {
        type: String,
        trim: true
    },
    startedAt: {
        type: Date
    },
    endedAt: {
        type: Date
    }
}, {
    timestamps: true
});

// Compound index for date and halqa queries
sessionSchema.index({ halqa: 1, date: -1 });
sessionSchema.index({ date: 1, status: 1 });

// Static method to get today's sessions
sessionSchema.statics.getTodaySessions = async function () {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return this.find({
        date: { $gte: today, $lt: tomorrow }
    }).populate('halqa').populate('teacher', 'name').populate('classroom', 'name');
};

// Method to check if session can be modified
sessionSchema.methods.canModify = function () {
    return this.status !== 'انتهت';
};

module.exports = mongoose.model('Session', sessionSchema);
