import "server-only";

export interface Mail {
  to: string;
  subject: string;
  text: string;
}

/**
 * Mail delivery. No provider is configured yet, so in development messages are
 * written to the server log. Production must wire a provider here before
 * password recovery is offered to real users.
 */
export async function sendMail(mail: Mail): Promise<void> {
  if (process.env.NODE_ENV === "production" && !process.env.MAIL_PROVIDER) {
    console.error("[mail] No MAIL_PROVIDER configured; message not sent:", mail.subject);
    return;
  }
  console.info(`[mail] To: ${mail.to}\nSubject: ${mail.subject}\n\n${mail.text}\n`);
}
