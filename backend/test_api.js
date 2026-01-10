const axios = require('axios');

async function testAPI() {
  try {
    console.log('Testing login...');

    // Try HR login
    const loginRes = await axios.post('https://hrms.gitakshmi.com/api/auth/login-hr', {
      companyCode: 'goo001',
      email: 'google@gmail.com',
      password: 'admin123'
    });

    console.log('Login successful:', loginRes.status);
    const token = loginRes.data.token;
    const tenantId = loginRes.data.user.tenant;

    console.log('Testing offer-templates API...');

    const res = await axios.get('https://hrms.gitakshmi.com/api/offer-templates', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-Tenant-ID': tenantId
      }
    });

    console.log('Testing offer-templates API...');

    const templateRes = await axios.get('https://hrms.gitakshmi.com/api/offer-templates', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-Tenant-ID': tenantId
      }
    });

    console.log('SUCCESS:', templateRes.status, templateRes.data.length ? `${templateRes.data.length} templates found` : 'No templates');

  } catch (err) {
    console.log('ERROR on /api/offer-templates:', err.response?.status, err.response?.data || err.message);
    console.log('Testing /api/hr/offer-templates instead...');

    try {
      const hrTemplateRes = await axios.get('https://hrms.gitakshmi.com/api/hr/offer-templates', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Tenant-ID': tenantId
        }
      });

      console.log('HR TEMPLATES SUCCESS:', hrTemplateRes.status, hrTemplateRes.data.length ? `${hrTemplateRes.data.length} templates found` : 'No templates');
    } catch (hrErr) {
      console.log('HR TEMPLATES ERROR:', hrErr.response?.status, hrErr.response?.data || hrErr.message);
    }
  }
}

testAPI();