export const metadata = { title: "Privacy policy" };

export default function Privacy() {
  return (
    <div className="container app-main prose">
      <h1 style={{ fontSize: "var(--text-3xl)", marginBottom: "var(--space-sm)" }}>Privacy policy</h1>
      <p className="muted">Version 2026-11-17 (updated for documents and AI explanations). Written to follow the Personal Information Protection and Electronic Documents Act (PIPEDA) and its ten fair information principles.</p>
      <h2>What we collect</h2>
      <p>Your email, an optional first name, and the answers you give in the assessment: date of birth, nationality, family, immigration status and history, education, language test results, work history and location preferences. We also keep sign-in records (time and IP address) for security.</p>
      <h2>Documents you upload</h2>
      <p>Uploads are optional and need your consent each time. Each file is encrypted with its own key. We read the text of PDF files to suggest dates and details and to check them against your profile; we never change your documents. Deleting a document destroys its key, so the file can't be recovered.</p>
      <h2>Optional AI explanations</h2>
      <p>If this site has AI explanations turned on, you can choose, per refusal letter, to send the letter&apos;s text to Anthropic (the maker of the Claude AI model) for a plain-language explanation. Nothing is sent unless you tick that box. Scores, eligibility, deadlines and legal references are never produced by AI.</p>
      <h2>Optional AI assistant</h2>
      <p>If the assistant is turned on, you can ask it about your results after agreeing, each time you use it, to send your questions and a summary of your computed results (scores, pathways, deadlines) to Anthropic. Your documents and full answers are not sent, and the conversation is not saved to your account.</p>
      <h2>Reminders</h2>
      <p>Deadline reminders appear in your account. Email reminders are off unless you turn them on in your account settings, and they mention the deadline, not your scores or documents.</p>
      <h2>Why</h2>
      <p>Only to calculate your scores, show your deadlines, and keep your history. We do not sell your information, use it for advertising, or share it with immigration authorities.</p>
      <h2>Consent</h2>
      <p>You agree when you create an account, and we record the date and the version of this policy you agreed to. Uploading documents, when that feature arrives, will ask for separate consent each time.</p>
      <h2>How we protect it</h2>
      <ul>
        <li>Your assessment answers and saved scenarios are encrypted (AES-256-GCM) before they are stored.</li>
        <li>Passwords are stored only as salted scrypt hashes. Sign-in sessions use random tokens, and we store only their hashes.</li>
        <li>Every request for your data is limited to your own account.</li>
        <li>All traffic uses encrypted connections.</li>
      </ul>
      <h2>Access and deletion</h2>
      <p>From your account page you can download everything we hold about you, or delete your account. Deletion removes your answers, scores, scenarios, reminders and sessions immediately. A minimal security log entry that an account was deleted is kept, without your email.</p>
      <h2>Retention</h2>
      <p>We keep your information while your account is open. If you don&apos;t sign in for 24 months, we email you a notice, and 30 days later we delete your account and everything in it unless you sign in. You can also delete it yourself at any time.</p>
      <h2>Questions and complaints</h2>
      <p>Contact the operator of this service. If you are not satisfied, you can complain to the Office of the Privacy Commissioner of Canada.</p>
    </div>
  );
}
