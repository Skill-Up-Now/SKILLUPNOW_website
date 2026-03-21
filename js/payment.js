/* ==========================================
   PAYMENT PROCESSING & RAZORPAY INTEGRATION
   ========================================== */

class PaymentProcessor {
  constructor() {
    this.razorpayKeyId = 'rzp_live_ILgsSZCZoFMQjO'; // Replace with your key
    this.currentOrder = null;
    this.currentPayment = null;
    this.setupRazorpay();
  }

  setupRazorpay() {
    if (typeof Razorpay === 'undefined') {
      console.warn('Razorpay SDK not loaded');
    }
  }

  // ==================== ORDER CREATION ====================
  async createOrder(amount, courseId, courseTitle) {
    try {
      const response = await fetch('/api/create-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          amount: amount * 100, // Razorpay expects amount in paise
          currency: 'INR',
          courseId: courseId,
          courseTitle: courseTitle
        })
      });

      if (!response.ok) throw new Error('Failed to create order');
      
      this.currentOrder = await response.json();
      return this.currentOrder;
    } catch (error) {
      console.error('Error creating order:', error);
      throw error;
    }
  }

  // ==================== PAYMENT PROCESSING ====================
  async processPayment(amount, courseData, userData) {
    if (typeof Razorpay === 'undefined') {
      return this.mockPaymentProcess(amount, courseData, userData);
    }

    try {
      const order = await this.createOrder(amount, courseData.id, courseData.title);
      
      const options = {
        key: this.razorpayKeyId,
        amount: amount * 100,
        currency: 'INR',
        order_id: order.id,
        name: 'SkillUpNow',
        description: courseData.title,
        image: 'https://skillupnow.com/logo.png',
        handler: this.handlePaymentSuccess.bind(this),
        prefill: {
          name: userData.name,
          email: userData.email,
          contact: userData.phone
        },
        notes: {
          courseId: courseData.id,
          courseTitle: courseData.title,
          userId: userData.id
        },
        theme: {
          color: '#7c5cfc'
        }
      };

      const razorpay = new Razorpay(options);
      razorpay.open();

      razorpay.on('payment.failed', this.handlePaymentFailure.bind(this));
    } catch (error) {
      console.error('Payment processing error:', error);
      throw error;
    }
  }

  // ==================== PAYMENT SUCCESS ====================
  async handlePaymentSuccess(response) {
    try {
      const verifyResponse = await fetch('/api/verify-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          paymentId: response.razorpay_payment_id,
          orderId: response.razorpay_order_id,
          signature: response.razorpay_signature
        })
      });

      if (!verifyResponse.ok) throw new Error('Payment verification failed');

      this.currentPayment = await verifyResponse.json();
      
      // Save payment record
      this.savePaymentRecord({
        ...response,
        status: 'success',
        timestamp: new Date()
      });

      // Trigger success callback
      this.triggerPaymentSuccess(this.currentPayment);

      return this.currentPayment;
    } catch (error) {
      console.error('Payment verification error:', error);
      this.triggerPaymentError(error);
    }
  }

  handlePaymentFailure(error) {
    console.error('Payment failed:', error);
    
    this.savePaymentRecord({
      status: 'failed',
      error: error,
      timestamp: new Date()
    });

    this.triggerPaymentFailure(error);
  }

  // ==================== MOCK PAYMENT (For Development) ====================
  async mockPaymentProcess(amount, courseData, userData) {
    return new Promise((resolve, reject) => {
      this.currentPayment = {
        id: Math.random().toString(36).substr(2, 9),
        amount: amount,
        course: courseData,
        user: userData,
        status: 'success',
        timestamp: new Date(),
        method: 'mock'
      };

      this.savePaymentRecord(this.currentPayment);
      
      setTimeout(() => {
        this.triggerPaymentSuccess(this.currentPayment);
        resolve(this.currentPayment);
      }, 1000);
    });
  }

  // ==================== EMI PAYMENT ====================
  async processEMIPayment(emiOption, courseData, userData) {
    try {
      const firstEMI = emiOption.emi;
      
      const response = await fetch('/api/create-emi-subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          courseId: courseData.id,
          totalAmount: emiOption.totalAmount,
          emiAmount: firstEMI,
          months: emiOption.months,
          interestRate: emiOption.rate,
          userData: userData
        })
      });

      if (!response.ok) throw new Error('EMI subscription failed');

      const emiSubscription = await response.json();
      
      // Process first EMI payment
      return await this.processPayment(firstEMI, courseData, userData);
    } catch (error) {
      console.error('EMI processing error:', error);
      throw error;
    }
  }

  // ==================== PAYMENT RECORD MANAGEMENT ====================
  savePaymentRecord(paymentData) {
    let payments = JSON.parse(localStorage.getItem('payments') || '[]');
    payments.push(paymentData);
    localStorage.setItem('payments', JSON.stringify(payments));
  }

  getPaymentHistory() {
    return JSON.parse(localStorage.getItem('payments') || '[]');
  }

  getPaymentById(paymentId) {
    const payments = this.getPaymentHistory();
    return payments.find(p => p.id === paymentId);
  }

  // ==================== REFUND PROCESSING ====================
  async processRefund(paymentId, amount) {
    try {
      const response = await fetch('/api/process-refund', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          paymentId: paymentId,
          amount: amount * 100
        })
      });

      if (!response.ok) throw new Error('Refund failed');

      const refund = await response.json();
      
      // Update payment status
      let payments = this.getPaymentHistory();
      const index = payments.findIndex(p => p.id === paymentId);
      if (index > -1) {
        payments[index].refund = refund;
        payments[index].refundStatus = 'processed';
        localStorage.setItem('payments', JSON.stringify(payments));
      }

      return refund;
    } catch (error) {
      console.error('Refund processing error:', error);
      throw error;
    }
  }

  // ==================== INVOICE GENERATION ====================
  generateInvoice(paymentId) {
    const payment = this.getPaymentById(paymentId);
    if (!payment) throw new Error('Payment not found');

    const invoice = {
      number: `INV-${paymentId}`,
      date: new Date(payment.timestamp).toLocaleDateString('en-IN'),
      amount: payment.amount,
      course: payment.course,
      user: payment.user,
      status: payment.status,
      paymentMethod: payment.method || 'Razorpay'
    };

    return invoice;
  }

  downloadInvoice(paymentId) {
    const invoice = this.generateInvoice(paymentId);
    
    const content = `
      INVOICE
      ========================================
      Invoice Number: ${invoice.number}
      Date: ${invoice.date}
      
      BILL TO:
      Name: ${invoice.user.name}
      Email: ${invoice.user.email}
      
      COURSE DETAILS:
      Course: ${invoice.course.title}
      Amount: ₹${invoice.amount}
      
      PAYMENT METHOD: ${invoice.paymentMethod}
      STATUS: ${invoice.status.toUpperCase()}
      ========================================
    `;

    const element = document.createElement('a');
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(content));
    element.setAttribute('download', `invoice-${paymentId}.txt`);
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  }

  // ==================== PAYMENT EVENTS ====================
  onPaymentSuccess(callback) {
    document.addEventListener('paymentSuccess', (e) => callback(e.detail));
  }

  onPaymentFailure(callback) {
    document.addEventListener('paymentFailure', (e) => callback(e.detail));
  }

  onPaymentError(callback) {
    document.addEventListener('paymentError', (e) => callback(e.detail));
  }

  triggerPaymentSuccess(paymentData) {
    const event = new CustomEvent('paymentSuccess', { detail: paymentData });
    document.dispatchEvent(event);
    
    if (window.app) {
      window.app.showNotification('Payment successful! Your course access has been activated.', 'success');
    }
  }

  triggerPaymentFailure(error) {
    const event = new CustomEvent('paymentFailure', { detail: error });
    document.dispatchEvent(event);
    
    if (window.app) {
      window.app.showNotification('Payment failed. Please try again.', 'error');
    }
  }

  triggerPaymentError(error) {
    const event = new CustomEvent('paymentError', { detail: error });
    document.dispatchEvent(event);
  }

  // ==================== SUBSCRIPTION MANAGEMENT ====================
  async createSubscription(planId, userData) {
    try {
      const response = await fetch('/api/create-subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          planId: planId,
          userData: userData
        })
      });

      if (!response.ok) throw new Error('Subscription creation failed');

      return await response.json();
    } catch (error) {
      console.error('Subscription error:', error);
      throw error;
    }
  }

  async cancelSubscription(subscriptionId) {
    try {
      const response = await fetch(`/api/cancel-subscription/${subscriptionId}`, {
        method: 'POST'
      });

      if (!response.ok) throw new Error('Subscription cancellation failed');

      return await response.json();
    } catch (error) {
      console.error('Cancellation error:', error);
      throw error;
    }
  }

  // ==================== UTILITIES ====================
  formatAmount(amount) {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0
    }).format(amount);
  }

  getPaymentStatus(status) {
    const statusMap = {
      'success': 'Completed',
      'failed': 'Failed',
      'pending': 'Pending',
      'cancelled': 'Cancelled'
    };
    return statusMap[status] || status;
  }
}

// Initialize payment processor
document.addEventListener('DOMContentLoaded', () => {
  window.paymentProcessor = new PaymentProcessor();
});

// Export for use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PaymentProcessor;
}
