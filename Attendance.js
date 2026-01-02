const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
    student: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Student',
        required: [true, 'الطالب مطلوب']
    },
    session: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Session',
        required: [true, 'الجلسة مطلوبة']
    },
    status: {
        type: String,
        enum: ['حاضر', 'غائب', 'متأخر', 'مستأذن'],
        default: 'حاضر'
    },
    arrivedAt: {
        type: Date
    },
    leftAt: {
        type: Date
    },
    notes: {
        type: String,
        trim: true
    },
    // Enhanced attendance tracking
    absenceReason: {
        type: String,
        trim: true
    },
    recordedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    recordedAt: {
        type: Date,
        default: Date.now
    },
    isLate: {
        type: Boolean,
        default: false
    },
    lateMinutes: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});

// Compound unique index
attendanceSchema.index({ student: 1, session: 1 }, { unique: true });

// Static method to get attendance stats for a session
attendanceSchema.statics.getSessionStats = async function (sessionId) {
    const stats = await this.aggregate([
        { $match: { session: new mongoose.Types.ObjectId(sessionId) } },
        {
            $group: {
                _id: '$status',
                count: { $sum: 1 }
            }
        }
    ]);

    return stats.reduce((acc, curr) => {
        acc[curr._id] = curr.count;
        return acc;
    }, {});
};

// Static method to get attendance by date range
attendanceSchema.statics.getStudentAttendance = async function (studentId, startDate, endDate) {
    return this.find({
        student: studentId,
        createdAt: { $gte: startDate, $lte: endDate }
    }).populate('session');
};

module.exports = mongoose.model('Attendance', attendanceSchema);
