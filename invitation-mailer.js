const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
})[character]);

export class InvitationMailer {
  get configured() { return false; }
  async sendInvitation() {
    return { delivered: false, reason: "not_configured" };
  }
}

export class DevelopmentInvitationMailer extends InvitationMailer {
  constructor({ onPreview = null } = {}) {
    super();
    this.onPreview = onPreview;
  }
  async sendInvitation(message) {
    const preview = invitationEmail(message);
    this.onPreview?.(preview);
    return { delivered: false, reason: "development_preview", preview };
  }
}

export function invitationEmail({ inviterName, projectName, cinematicRole, projectRole, invitationUrl, expiresAt }) {
  const subject = `${inviterName} invited you to collaborate on ${projectName} in FilmScript`;
  const role = String(cinematicRole || "Collaborator").replaceAll("_", " ");
  const access = String(projectRole || "viewer").replaceAll("_", " ");
  const expiration = expiresAt ? `This invitation expires ${new Date(expiresAt).toLocaleString("en", { dateStyle: "long", timeStyle: "short" })}.` : "";
  const text = `${inviterName} invited you to collaborate on ${projectName} in FilmScript.\n\nCinematic role: ${role}\nProject role: ${access}\n${expiration}\n\nOpen invitation: ${invitationUrl}`;
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(subject)}</title></head><body style="margin:0;background:#faf7f2;color:#111;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Text',Helvetica,Arial,sans-serif"><main style="max-width:600px;margin:0 auto;padding:48px 24px"><p style="font-size:13px;font-weight:800;letter-spacing:.12em">FILMSCRIPT</p><section style="background:#fffef9;border:1px solid #d8d2c8;border-radius:20px 18px 21px 17px;padding:32px"><h1 style="font-size:28px;line-height:1.12;margin:0 0 18px">You are invited to collaborate</h1><p style="font-size:16px;line-height:1.55">${escapeHtml(inviterName)} invited you to work on <strong>${escapeHtml(projectName)}</strong>.</p><div style="margin:24px 0;padding:16px;background:#f3f0ea;border-radius:12px"><p style="margin:0 0 8px"><strong>Cinematic role:</strong> ${escapeHtml(role)}</p><p style="margin:0"><strong>Project role:</strong> ${escapeHtml(access)}</p></div><a href="${escapeHtml(invitationUrl)}" style="display:inline-block;background:#ffb703;color:#111;text-decoration:none;font-weight:750;padding:13px 20px;border-radius:11px">Open invitation</a>${expiration ? `<p style="margin:22px 0 0;color:#656565;font-size:13px">${escapeHtml(expiration)}</p>` : ""}</section><p style="color:#656565;font-size:12px;line-height:1.5;margin:18px 4px">If you did not expect this invitation, you can ignore this email.</p></main></body></html>`;
  return { subject, text, html };
}

export const invitationMailer = new DevelopmentInvitationMailer();
