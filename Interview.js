const mongoose = require('mongoose');

const interviewSchema = new mongoose.Schema({
    student: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Student',
        required: [true, 'الطالب مطلوب']
    },
    scheduledDate: {
        type: Date,
        required: [true, 'تاريخ المقابلة مطلوب']
    },
    scheduledBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    conductor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'  // Manager who conducts the interview
    },
    status: {
        type: String,
        enum: ['scheduled', 'completed', 'cancelled', 'rescheduled'],
        default: 'scheduled'
    },
    result: {
        type: String,
        enum: ['accepted', 'rejected', 'pending', null],
        default: null
    },
    notes: {
        type: String,
        trim: true
    },
    conductedAt: {
        type: Date
    },
    dayOfWeek: {
        type: String,
        enum: ['السبت', 'الثلاثاء'],  // Only Saturday and Tuesday after Asr
        required: true
    },
    timeSlot: {
        type: String,
        default: 'بعد العصر'  // After Asr prayer
    }
}, {
    timestamps: true
});

// Index for efficient queries
interviewSchema.index({ scheduledDate: 1, status: 1 });
interviewSchema.index({ student: 1 });
interviewSchema.index({ conductor: 1, status: 1 });

// Static method to find next available interview slot
interviewSchema.statics.getNextAvailableSlot = async function () {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Find next Saturday or Tuesday
    const dayOfWeek = today.getDay();
    let daysUntilSaturday = (6 - dayOfWeek + 7) % 7;
    let daysUntilTuesday = (2 - dayOfWeek + 7) % 7;

    // If today is the day and it's past the time, add 7 days
    if (daysUntilSaturday === 0) daysUntilSaturday = 7;
    if (daysUntilTuesday === 0) daysUntilTuesday = 7;

    const nextSaturday = new Date(today);
    nextSaturday.setDate(today.getDate() + daysUntilSaturday);

    const nextTuesday = new Date(today);
    nextTuesday.setDate(today.getDate() + daysUntilTuesday);

    // Return the nearest date
    if (daysUntilSaturday <= daysUntilTuesday) {
        return { date: nextSaturday, dayOfWeek: 'السبت' };
    } else {
        return { date: nextTuesday, dayOfWeek: 'الثلاثاء' };
    }
};

// Method to check if interview can be rescheduled
interviewSchema.methods.canReschedule = function () {
    return this.status === 'scheduled' && new Date(this.scheduledDate) > new Date();
};

module.exports = mongoose.model('Interview', interviewSchema);
