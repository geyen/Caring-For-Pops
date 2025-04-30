/**
 * Caring for Pops - Main JavaScript
 */

// Wait for the DOM to be fully loaded
document.addEventListener('DOMContentLoaded', function() {
  // Mobile Menu Toggle
  initMobileMenu();
  
  // Smooth Scrolling for Anchor Links
  initSmoothScrolling();
  
  // Form Validation & Submission
  initForms();
});

/**
 * Initialize Mobile Menu Toggle
 */
function initMobileMenu() {
  const menuToggle = document.querySelector('.mobile-menu-toggle');
  const mainNav = document.querySelector('.main-nav');
  
  if (menuToggle && mainNav) {
    menuToggle.addEventListener('click', function() {
      mainNav.classList.toggle('active');
      this.classList.toggle('active');
    });
    
    // Close mobile menu when clicking on a link
    document.querySelectorAll('.main-nav a').forEach(link => {
      link.addEventListener('click', function() {
        mainNav.classList.remove('active');
        menuToggle.classList.remove('active');
      });
    });
    
    // Close mobile menu when clicking outside
    document.addEventListener('click', function(event) {
      if (!menuToggle.contains(event.target) && !mainNav.contains(event.target)) {
        mainNav.classList.remove('active');
        menuToggle.classList.remove('active');
      }
    });
  }
}

/**
 * Initialize Smooth Scrolling for Anchor Links
 */
function initSmoothScrolling() {
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      e.preventDefault();
      
      const targetId = this.getAttribute('href');
      
      // Skip if the href is just "#"
      if (targetId === '#') return;
      
      const targetElement = document.querySelector(targetId);
      
      if (targetElement) {
        const headerHeight = document.querySelector('.main-header').offsetHeight;
        const targetPosition = targetElement.getBoundingClientRect().top + window.pageYOffset;
        
        window.scrollTo({
          top: targetPosition - headerHeight,
          behavior: 'smooth'
        });
      }
    });
  });
}

/**
 * Initialize Forms Validation & Submission
 */
function initForms() {
  // Care Request Form
  const careRequestForm = document.getElementById('careRequestForm');
  
  if (careRequestForm) {
    careRequestForm.addEventListener('submit', function(e) {
      e.preventDefault();
      
      if (validateForm(careRequestForm)) {
        submitCareRequestForm(careRequestForm);
      }
    });
  }
  
  // Newsletter Form
  const newsletterForm = document.querySelector('.newsletter-form');
  
  if (newsletterForm) {
    newsletterForm.addEventListener('submit', function(e) {
      e.preventDefault();
      
      if (validateForm(newsletterForm)) {
        submitNewsletterForm(newsletterForm);
      }
    });
  }
}

/**
 * Validate Form Fields
 * @param {HTMLFormElement} form - The form element to validate
 * @returns {boolean} - Whether the form is valid
 */
function validateForm(form) {
  let isValid = true;
  const requiredFields = form.querySelectorAll('[required]');
  
  // Remove any existing error messages
  form.querySelectorAll('.error-message').forEach(el => el.remove());
  
  requiredFields.forEach(field => {
    field.classList.remove('error');
    
    if (field.tagName.toLowerCase() === 'select' && field.value === '') {
      showErrorMessage(field, 'Please select an option');
      isValid = false;
    } else if (field.type === 'email' && field.value !== '' && !isValidEmail(field.value)) {
      showErrorMessage(field, 'Please enter a valid email address');
      isValid = false;
    } else if (field.type === 'tel' && field.value !== '' && !isValidPhone(field.value)) {
      showErrorMessage(field, 'Please enter a valid phone number');
      isValid = false;
    } else if (field.value.trim() === '') {
      showErrorMessage(field, 'This field is required');
      isValid = false;
    }
  });
  
  return isValid;
}

/**
 * Show an error message for a form field
 * @param {HTMLElement} field - The field with the error
 * @param {string} message - The error message to display
 */
function showErrorMessage(field, message) {
  field.classList.add('error');
  
  const errorElement = document.createElement('div');
  errorElement.className = 'error-message';
  errorElement.textContent = message;
  
  field.parentNode.appendChild(errorElement);
}

/**
 * Validate Email Format
 * @param {string} email - The email to validate
 * @returns {boolean} - Whether the email is valid
 */
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate Phone Number Format
 * @param {string} phone - The phone number to validate
 * @returns {boolean} - Whether the phone number is valid
 */
function isValidPhone(phone) {
  const phoneRegex = /^[\d\s\-\(\)\.]{10,15}$/;
  return phoneRegex.test(phone);
}

/**
 * Submit Care Request Form
 * @param {HTMLFormElement} form - The form to submit
 */
function submitCareRequestForm(form) {
  const formData = new FormData(form);
  const formObject = {};
  formData.forEach((value, key) => {
    formObject[key] = value;
  });
  
  // In a real application, this would be an API call
  // For now, we're simulating a successful submission
  console.log('Care request form submitted with data:', formObject);
  
  showFormMessage(form, 'success', 'Thank You!', 'Your care request has been submitted successfully. A matched provider will contact you within 24-48 hours.');
}

/**
 * Submit Newsletter Form
 * @param {HTMLFormElement} form - The form to submit
 */
function submitNewsletterForm(form) {
  const email = form.querySelector('input[type="email"]').value;
  
  // In a real application, this would be an API call
  // For now, we're simulating a successful submission
  console.log('Newsletter form submitted with email:', email);
  
  showFormMessage(form, 'success', 'Thank You!', 'You have been successfully subscribed to our newsletter.');
}

/**
 * Show a form submission message
 * @param {HTMLFormElement} form - The form that was submitted
 * @param {string} type - The type of message ('success', 'error')
 * @param {string} title - The message title
 * @param {string} message - The message content
 */
function showFormMessage(type, message) {
  // Get the form container
  const formContainer = document.querySelector('.form-container');
  
  if (formContainer) {
    const iconSvg = type === 'success' 
      ? '<svg width="64" height="64" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM10 17L5 12L6.41 10.59L10 14.17L17.59 6.58L19 8L10 17Z" fill="var(--success)"/></svg>'
      : '<svg width="64" height="64" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM13 17H11V15H13V17ZM13 13H11V7H13V13Z" fill="var(--error)"/></svg>';
    
    const title = type === 'success' ? 'Thank You!' : 'Error';
    
    // Replace the form with a success message
    formContainer.innerHTML = `
      <div class="form-${type}">
        ${iconSvg}
        <h3>${title}</h3>
        <p>${message}</p>
        <button type="button" class="btn btn-outline" onclick="location.reload()">Back to Form</button>
      </div>
    `;
  }
}