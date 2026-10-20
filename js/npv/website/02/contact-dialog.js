export class ContactDialog {
  constructor() {
    this.dialog = document.querySelector('#contact-dialog');
    this.trigger = document.querySelector('.contact-button');
    this.form = this.dialog.querySelector('form');
    this.status = this.dialog.querySelector('[role="status"]');
    this.trigger.addEventListener('click', () => this.open());
    this.dialog.querySelector('.dialog-close').addEventListener('click', () => this.dialog.close());
    // A drag that starts inside a field must never dismiss the form.
    this.dialog.addEventListener('pointerdown', event => { this.backdropDown = this.isOutside(event); });
    this.dialog.addEventListener('click', event => {
      if (this.backdropDown && this.isOutside(event)) this.dialog.close();
    });
    this.dialog.addEventListener('keydown', event => {
      if (event.key !== 'Tab') return;
      const controls = [...this.dialog.querySelectorAll('button, input, textarea')]
        .filter(control => !control.disabled && control.tabIndex >= 0);
      const current = controls.indexOf(document.activeElement);
      const next = (current + (event.shiftKey ? -1 : 1) + controls.length) % controls.length;
      event.preventDefault();
      controls[next].focus();
    });
    this.dialog.addEventListener('close', () => {
      document.documentElement.classList.remove('contact-open');
      this.trigger.focus({preventScroll: true});
    });
    for (const field of this.form.querySelectorAll('input, textarea')) {
      field.addEventListener('input', () => {
        field.setCustomValidity(field.value && !field.value.trim() ? 'Please enter a value.' : '');
      });
    }
    this.form.addEventListener('submit', event => {
      event.preventDefault();
      // Prototype only: retain the draft, and never claim that it was sent.
      this.status.textContent = 'Preview only. Your message hasn’t been sent.';
    });
  }

  isOutside(event) {
    if (event.target !== this.dialog) return false;
    const rect = this.dialog.getBoundingClientRect();
    return event.clientX < rect.left || event.clientX > rect.right
      || event.clientY < rect.top || event.clientY > rect.bottom;
  }

  open() {
    if (this.dialog.open) return;
    document.documentElement.classList.add('contact-open');
    this.dialog.showModal();
  }
}
