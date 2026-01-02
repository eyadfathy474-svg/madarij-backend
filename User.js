const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'الاسم مطلوب'],
        trim: true
    },
    email: {
        type: String,
        required: [true, 'البريد الإلكتروني مطلوب'],
        unique: true,
        lowercase: true,
        trim: true
    },
    password: {
        type: String,
        required: [true, 'كلمة المرور مطلوبة'],
        minlength: 6,
        select: false
    },
    role: {
        type: String,
        enum: ['director', 'supervisor', 'teacher', 'student_affairs'],
        required: [true, 'الدور مطلوب']
    },
    isActive: {
        type: Boolean,
        default: true
    },
    phone: {
        type: String,
        trim: true
    },
    assignedHalqat: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Halqa'
    }]
}, {
    timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function () {
    if (!this.isModified('password')) return;
    this.password = await bcrypt.hash(this.password, 12);
});

// Compare password method
userSchema.methods.comparePassword = async function (candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

// Get role display name in Arabic
userSchema.methods.getRoleDisplayName = function () {
    const roles = {
        director: 'المدير',
        supervisor: 'المشرف',
        teacher: 'المعلم',
        student_affairs: 'موظف شؤون الطلاب'
    };
    return roles[this.role] || this.role;
};

module.exports = mongoose.model('User', userSchema);
