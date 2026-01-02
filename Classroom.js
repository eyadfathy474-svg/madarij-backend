const mongoose = require('mongoose');

const classroomSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'اسم الفصل مطلوب'],
        trim: true
    },
    capacity: {
        type: Number,
        default: 30
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
    timestamps: true
});

module.exports = mongoose.model('Classroom', classroomSchema);
