const mongoose = require('mongoose');

const performanceSchema = new mongoose.Schema({
    session: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Session',
        required: [true, 'الجلسة مطلوبة']
    },
    student: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Student',
        required: [true, 'الطالب مطلوب']
    },
    memorizedAmount: {
        type: String,
        required: [true, 'مقدار الحفظ مطلوب']
    },
    memorizedFrom: {
        surah: String,
        ayah: Number
    },
    memorizedTo: {
        surah: String,
        ayah: Number
    },
    reviewAmount: {
        type: String
    },
    rating: {
        type: String,
        enum: ['ممتاز', 'جيد جداً', 'جيد', 'مقبول', 'يحتاج متابعة'],
        default: 'جيد'
    },
    tajweedRating: {
        type: String,
        enum: ['ممتاز', 'جيد جداً', 'جيد', 'مقبول', 'يحتاج متابعة'],
        default: 'جيد'
    },
    tafseerCompleted: {
        type: Boolean,
        default: false
    },
    notes: {
        type: String,
        trim: true
    }
}, {
    timestamps: true
});

// Compound index
performanceSchema.index({ student: 1, session: 1 }, { unique: true });

// Static method to get student progress
performanceSchema.statics.getStudentProgress = async function (studentId, startDate, endDate) {
    return this.aggregate([
        {
            $match: {
                student: new mongoose.Types.ObjectId(studentId),
                createdAt: { $gte: startDate, $lte: endDate }
            }
        },
        {
            $group: {
                _id: '$rating',
                count: { $sum: 1 }
            }
        }
    ]);
};

module.exports = mongoose.model('Performance', performanceSchema);
