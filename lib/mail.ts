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
/** Returns true only when the message was actually handed to a delivery service (or, in development, logged). */
export async function sendMail(mail: Mail): Promise<boolean> {
  if (process.env.NODE_ENV === "production" && !process.env.MAIL_PROVIDER) {
    console.error("[mail] No MAIL_PROVIDER configured; message not sent:", mail.subject);
    return false;
  }
  console.info(`[mail] To: ${mail.to}\nSubject: ${mail.subject}\n\n${mail.text}\n`);
  return true;
}
