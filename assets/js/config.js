/* GIO Spark — site settings. Edit these values to update contact details site-wide in scripts. */
window.GIOSPARK = {
  brand: 'GIO Spark',
  company: 'Chaudhary Enterprises',
  phone: '+917818864533',
  phoneDisplay: '+91 78188 64533',
  whatsapp: '917818864533',
  email: 'info@giospark.com',

  // Forms are POSTed here as JSON.
  //   Vercel:      '/api/send'  (api/send.js — needs RESEND_API_KEY set in the Vercel project)
  //   PHP hosting: 'send.php'
  //   Web3Forms:   'https://api.web3forms.com/submit' and put { access_key: '…' } in formExtra
  // If sending fails or no endpoint is set, visitors get one-tap WhatsApp / email buttons instead.
  formEndpoint: '/api/send',
  formExtra: {}
};
