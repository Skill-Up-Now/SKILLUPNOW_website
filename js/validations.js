/* ==========================================
   VALIDATION UTILITIES
   ========================================== */

class FormValidator {
  constructor(formElement) {
    this.form = formElement;
    this.errors = {};
    this.fields = {};
    this.setupFieldTracking();
  }

  setupFieldTracking() {
    this.form.querySelectorAll('input, select, textarea').forEach(field => {
      this.fields[field.name] = field;
      
      field.addEventListener('blur', () => this.validateField(field.name));
      field.addEventListener('input', () => this.clearFieldError(field.name));
    });
  }

  validateField(fieldName) {
    const field = this.fields[fieldName];
    if (!field) return true;

    const value = field.value.trim();
    const rules = field.dataset.validate ? field.dataset.validate.split('|') : [];
    const errors = [];

    for (const rule of rules) {
      const result = this.applyRule(rule, value, field);
      if (result !== true) {
        errors.push(result);
      }
    }

    this.errors[fieldName] = errors;
    this.showFieldError(fieldName, errors);
    
    return errors.length === 0;
  }

  applyRule(rule, value, field) {
    const [ruleName, ...params] = rule.split(':');

    switch (ruleName) {
      case 'required':
        return value === '' ? 'This field is required' : true;

      case 'email':
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return !emailRegex.test(value) ? 'Please enter a valid email address' : true;

      case 'phone':
        const phoneRegex = /^(\+\d{1,3}[- ]?)?\d{10,}$/;
        return !phoneRegex.test(value.replace(/[-\s]/g, '')) ? 'Please enter a valid phone number' : true;

      case 'password':
        if (value.length < 8) return 'Password must be at least 8 characters long';
        if (!/[A-Z]/.test(value)) return 'Password must contain an uppercase letter';
        if (!/[a-z]/.test(value)) return 'Password must contain a lowercase letter';
        if (!/[0-9]/.test(value)) return 'Password must contain a number';
        if (!/[!@#$%^&*]/.test(value)) return 'Password must contain a special character (!@#$%^&*)';
        return true;

      case 'match':
        const matchField = params[0];
        const matchValue = this.fields[matchField]?.value || '';
        return value !== matchValue ? `This field must match ${matchField}` : true;

      case 'min':
        const minLength = parseInt(params[0]);
        return value.length < minLength ? `Minimum ${minLength} characters required` : true;

      case 'max':
        const maxLength = parseInt(params[0]);
        return value.length > maxLength ? `Maximum ${maxLength} characters allowed` : true;

      case 'number':
        return isNaN(value) ? 'Please enter a valid number' : true;

      case 'integer':
        return !Number.isInteger(Number(value)) ? 'Please enter a valid integer' : true;

      case 'url':
        try {
          new URL(value);
          return true;
        } catch {
          return 'Please enter a valid URL';
        }

      case 'creditcard':
        const ccRegex = /^[0-9]{13,19}$/;
        if (!ccRegex.test(value.replace(/\s/g, ''))) return 'Please enter a valid credit card number';
        return this.luhnCheck(value) ? true : 'Invalid credit card number';

      case 'zipcode':
        const zipcodeRegex = /^[0-9]{5,6}(-[0-9]{4})?$/;
        return !zipcodeRegex.test(value) ? 'Please enter a valid zip code' : true;

      case 'aadhar':
        const aadharRegex = /^[0-9]{12}$/;
        return !aadharRegex.test(value) ? 'Please enter a valid Aadhar number' : true;

      case 'pan':
        const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
        return !panRegex.test(value) ? 'Please enter a valid PAN number' : true;

      case 'gst':
        const gstRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[Z]{1}[0-9]{1}$/;
        return !gstRegex.test(value) ? 'Please enter a valid GST number' : true;

      case 'ifsc':
        const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
        return !ifscRegex.test(value) ? 'Please enter a valid IFSC code' : true;

      case 'date':
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(value)) return 'Please enter date in YYYY-MM-DD format';
        const date = new Date(value);
        return isNaN(date.getTime()) ? 'Please enter a valid date' : true;

      case 'age':
        const minAge = parseInt(params[0]);
        const birthDate = new Date(value);
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
          age--;
        }
        return age < minAge ? `Must be at least ${minAge} years old` : true;

      case 'checked':
        return !field.checked ? 'This field must be checked' : true;

      case 'file':
        const allowedTypes = params;
        if (field.files.length === 0) return 'Please select a file';
        const fileType = field.files[0].type;
        return allowedTypes.length > 0 && !allowedTypes.includes(fileType) 
          ? `Only ${allowedTypes.join(', ')} files are allowed` : true;

      default:
        return true;
    }
  }

  luhnCheck(num) {
    const digits = num.replace(/\D/g, '');
    let sum = 0;
    let isEven = false;

    for (let i = digits.length - 1; i >= 0; i--) {
      let digit = parseInt(digits[i], 10);

      if (isEven) {
        digit *= 2;
        if (digit > 9) {
          digit -= 9;
        }
      }

      sum += digit;
      isEven = !isEven;
    }

    return sum % 10 === 0;
  }

  showFieldError(fieldName, errors) {
    const field = this.fields[fieldName];
    const formGroup = field.closest('.form-group');
    
    if (!formGroup) return;

    const existingMessage = formGroup.querySelector('.form-message.error');
    if (existingMessage) {
      existingMessage.remove();
    }

    formGroup.classList.remove('has-error', 'has-success');
    
    if (errors.length > 0) {
      formGroup.classList.add('has-error');
      field.setAttribute('aria-invalid', 'true');
      
      const errorMsg = document.createElement('div');
      errorMsg.className = 'form-message error';
      errorMsg.textContent = errors[0];
      formGroup.appendChild(errorMsg);
    } else {
      formGroup.classList.add('has-success');
      field.setAttribute('aria-invalid', 'false');
    }
  }

  clearFieldError(fieldName) {
    const field = this.fields[fieldName];
    const formGroup = field.closest('.form-group');
    
    if (formGroup) {
      formGroup.classList.remove('has-error');
      const errorMsg = formGroup.querySelector('.form-message.error');
      if (errorMsg) {
        errorMsg.remove();
      }
    }
  }

  validateAll() {
    let isValid = true;
    Object.keys(this.fields).forEach(fieldName => {
      if (!this.validateField(fieldName)) {
        isValid = false;
      }
    });
    return isValid;
  }

  getErrors() {
    return this.errors;
  }

  getFormData() {
    const formData = new FormData(this.form);
    const data = Object.fromEntries(formData);
    return data;
  }

  reset() {
    this.form.reset();
    this.errors = {};
    Object.values(this.fields).forEach(field => {
      const formGroup = field.closest('.form-group');
      if (formGroup) {
        formGroup.classList.remove('has-error', 'has-success');
        const errorMsg = formGroup.querySelector('.form-message');
        if (errorMsg) {
          errorMsg.remove();
        }
      }
    });
  }

  async validateAsync(fieldName) {
    const field = this.fields[fieldName];
    if (!field || !field.dataset.validateAsync) return true;

    const asyncValidation = field.dataset.validateAsync;
    // This would handle async validations like checking if email exists
    return true;
  }
}

// Standalone Validation Functions
const Validations = {
  isEmail: (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),
  
  isPhone: (phone) => /^(\+\d{1,3}[- ]?)?\d{10,}$/.test(phone.replace(/[-\s]/g, '')),
  
  isPassword: (password) => {
    return password.length >= 8 &&
           /[A-Z]/.test(password) &&
           /[a-z]/.test(password) &&
           /[0-9]/.test(password) &&
           /[!@#$%^&*]/.test(password);
  },
  
  isURL: (url) => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  },
  
  isCreditCard: (cc) => {
    const digits = cc.replace(/\D/g, '');
    if (!/^\d{13,19}$/.test(digits)) return false;
    
    let sum = 0;
    let isEven = false;
    for (let i = digits.length - 1; i >= 0; i--) {
      let digit = parseInt(digits[i], 10);
      if (isEven) {
        digit *= 2;
        if (digit > 9) digit -= 9;
      }
      sum += digit;
      isEven = !isEven;
    }
    return sum % 10 === 0;
  },
  
  isAadhar: (aadhar) => /^[0-9]{12}$/.test(aadhar),
  
  isPAN: (pan) => /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(pan),
  
  isGST: (gst) => /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[Z]{1}[0-9]{1}$/.test(gst),
  
  isIFSC: (ifsc) => /^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc),
  
  isStrongPassword: (password) => {
    return password.length >= 12 &&
           /[A-Z]/.test(password) &&
           /[a-z]/.test(password) &&
           /[0-9]/.test(password) &&
           /[!@#$%^&*]/.test(password);
  },
  
  isInteger: (value) => Number.isInteger(Number(value)),
  
  isNumber: (value) => !isNaN(value) && value !== '',
  
  isPositiveNumber: (value) => !isNaN(value) && Number(value) > 0,
  
  getPasswordStrength: (password) => {
    let strength = 0;
    if (password.length >= 8) strength++;
    if (password.length >= 12) strength++;
    if (/[a-z]/.test(password)) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[!@#$%^&*]/.test(password)) strength++;
    
    const levels = ['Very Weak', 'Weak', 'Fair', 'Good', 'Strong', 'Very Strong'];
    return levels[strength] || 'Very Weak';
  }
};

// Export for use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { FormValidator, Validations };
}
