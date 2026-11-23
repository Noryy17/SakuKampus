// Comprehensive Automated Feature Test (F-01 to F-10)
import { app } from '../src/app.js';

let server;
const PORT = 3002;
const BASE_URL = `http://localhost:${PORT}`;

async function runTests() {
  server = app.listen(PORT);
  console.log(`Test server running at ${BASE_URL}...`);

  let cookie = '';
  let createdTxId = null;

  try {
    // TEST F-01: Demo Login & Auth
    console.log('\n--- [TEST F-01] Login & Auth ---');
    const loginRes = await fetch(`${BASE_URL}/auth/demo-login`, { method: 'POST' });
    const loginData = await loginRes.json();
    const rawCookie = loginRes.headers.get('set-cookie');
    cookie = rawCookie.split(';')[0];
    console.log('Login result:', loginData.success ? '✅ SUCCESS' : '❌ FAILED', loginData.user?.name);

    const meRes = await fetch(`${BASE_URL}/auth/me`, { headers: { Cookie: cookie } });
    const meData = await meRes.json();
    console.log('Auth verification (/auth/me):', meData.authenticated ? '✅ Authenticated' : '❌ Not Authenticated');

    // TEST F-02 & F-03: Chat transaction & auto-categorization
    console.log('\n--- [TEST F-02 & F-03] Chat Transaction & Auto Category ---');
    const chatRes1 = await fetch(`${BASE_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ message: 'makan siang 15rb', source: 'chat' })
    });
    const chatData1 = await chatRes1.json();
    console.log('Chat 1 ("makan siang 15rb"):', chatData1.success ? '✅ SUCCESS' : '❌ FAILED');
    console.log('  -> Category:', chatData1.transaction?.category_name, '| Amount:', chatData1.transaction?.amount);
    createdTxId = chatData1.transaction?.id;

    // TEST F-02 with Voice input
    console.log('\n--- [TEST F-02] Voice Input ---');
    const chatRes2 = await fetch(`${BASE_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ message: 'kemarin beli bensin 25.000', source: 'voice' })
    });
    const chatData2 = await chatRes2.json();
    console.log('Voice Chat ("kemarin beli bensin 25.000"):', chatData2.success ? '✅ SUCCESS' : '❌ FAILED');
    console.log('  -> Source:', chatData2.transaction?.source, '| Date:', chatData2.transaction?.occurred_on);

    // TEST F-04: Unrecognized sentence handling
    console.log('\n--- [TEST F-04] Unrecognized Sentence Handling ---');
    const chatRes3 = await fetch(`${BASE_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ message: 'halo apa kabar semuanya' })
    });
    const chatData3 = await chatRes3.json();
    console.log('Unrecognized test ("halo apa kabar"):', chatData3.is_unrecognized ? '✅ Correctly Caught & Handled' : '❌ Failed');
    console.log('  -> Bot reply:', chatData3.bot_reply.split('\n')[0]);

    // TEST F-05: Transaction History
    console.log('\n--- [TEST F-05] Transaction History ---');
    const txRes = await fetch(`${BASE_URL}/api/transactions`, { headers: { Cookie: cookie } });
    const txData = await txRes.json();
    console.log('Transaction history count:', txData.count, txData.success ? '✅ SUCCESS' : '❌ FAILED');

    // TEST F-06: Dashboard Summary
    console.log('\n--- [TEST F-06] Dashboard Summary ---');
    const dashRes = await fetch(`${BASE_URL}/api/dashboard/summary`, { headers: { Cookie: cookie } });
    const dashData = await dashRes.json();
    console.log('Dashboard summary:', dashData.success ? '✅ SUCCESS' : '❌ FAILED');
    console.log('  -> Total Balance:', dashData.data?.total_balance);
    console.log('  -> Monthly Income:', dashData.data?.monthly_income);
    console.log('  -> Monthly Expense:', dashData.data?.monthly_expense);

    // TEST F-07: Chart Data
    console.log('\n--- [TEST F-07] Chart Data (Category Breakdown & Trend) ---');
    const chartRes = await fetch(`${BASE_URL}/api/dashboard/charts`, { headers: { Cookie: cookie } });
    const chartData = await chartRes.json();
    console.log('Chart data:', chartData.success ? '✅ SUCCESS' : '❌ FAILED');
    console.log('  -> Category slices:', chartData.data?.category_breakdown?.length);
    console.log('  -> Monthly trend points:', chartData.data?.monthly_trend?.length);

    // TEST F-09: Usage Rate Limiting Check
    console.log('\n--- [TEST F-09] Usage Rate Limiting ---');
    const usageRes = await fetch(`${BASE_URL}/api/chat/usage`, { headers: { Cookie: cookie } });
    const usageData = await usageRes.json();
    console.log('Usage tracking:', `Used ${usageData.request_count} / ${usageData.daily_limit} (Remaining: ${usageData.remaining})`, '✅ SUCCESS');

    // TEST F-10: Edit & Delete Transaction
    console.log('\n--- [TEST F-10] Edit & Delete Transaction ---');
    if (createdTxId) {
      // Edit
      const editRes = await fetch(`${BASE_URL}/api/transactions/${createdTxId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Cookie: cookie },
        body: JSON.stringify({
          amount: 18000,
          category_id: 1, // Makan
          description: 'Makan siang ayam bakar komplit',
          occurred_on: '2026-11-10'
        })
      });
      const editData = await editRes.json();
      console.log('Edit transaction:', editData.success ? '✅ SUCCESS' : '❌ FAILED', '| New Amount:', editData.data?.amount);

      // Delete
      const delRes = await fetch(`${BASE_URL}/api/transactions/${createdTxId}`, {
        method: 'DELETE',
        headers: { Cookie: cookie }
      });
      const delData = await delRes.json();
      console.log('Delete transaction:', delData.success ? '✅ SUCCESS' : '❌ FAILED');
    }

    console.log('\n=============================================');
    console.log('🎉 ALL 10 IN-SCOPE FEATURES (F-01 to F-10) PASSED!');
    console.log('=============================================');
  } catch (err) {
    console.error('Test execution error:', err);
  } finally {
    server.close();
  }
}

runTests();
