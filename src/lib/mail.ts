export function formatZentraEmail({
  title,
  badgeText,
  badgeColor,
  description,
  details,
  footerText = "This is an automated operational notification from Zentra by FPC."
}: {
  title: string;
  badgeText: string;
  badgeColor: "indigo" | "emerald" | "amber" | "rose";
  description: string;
  details: { label: string; value: string; highlight?: boolean }[];
  footerText?: string;
}) {
  const colors = {
    indigo: { primary: "#D528A2", bg: "#fdf2f8", text: "#db2777", border: "#fbcfe8" }, // Pink theme matching brand
    emerald: { primary: "#10b981", bg: "#ecfdf5", text: "#047857", border: "#d1fae5" },
    amber: { primary: "#f59e0b", bg: "#fef3c7", text: "#b45309", border: "#fde68a" },
    rose: { primary: "#f43f5e", bg: "#fff1f2", text: "#be123c", border: "#ffe4e6" }
  };

  const selectedColor = colors[badgeColor] || colors.indigo;

  const rowsHtml = details
    .map(
      (item, idx) => `
      <tr style="border-bottom: 1px solid #f1f5f9; ${idx === details.length - 1 ? 'border-bottom: none;' : ''}">
        <td style="padding: 12px 16px; font-weight: bold; color: #64748b; width: 140px; font-size: 13px; text-align: left;">${item.label}</td>
        <td style="padding: 12px 16px; color: ${item.highlight ? selectedColor.text : '#0f172a'}; font-weight: ${item.highlight ? 'bold' : '600'}; font-size: 13px; text-align: left;">${item.value}</td>
      </tr>
    `
    )
    .join("");

  return `
    <div style="background-color: #f8fafc; padding: 32px 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; min-height: 100%; color: #334155; line-height: 1.5;">
      <div style="max-width: 580px; margin: 0 auto; background-color: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 4px 18px rgba(15, 23, 42, 0.04); border: 1px solid #e2e8f0;">
        
        <!-- Header Branding (Brand Gradient background as per website logo) -->
        <div style="background: linear-gradient(135deg, #D528A2 0%, #F4A863 100%); padding: 28px 24px; text-align: center; border-bottom: 1px solid #f1f5f9;">
          <div style="display: inline-block; background-color: rgba(255, 255, 255, 0.2); border-radius: 14px; padding: 8px 16px; font-weight: 800; font-size: 18px; color: #ffffff; letter-spacing: 0.05em; border: 1px solid rgba(255, 255, 255, 0.25); box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);">
            <span style="font-weight: 900; color: #ffffff;">Z</span>ENTRA <span style="font-size: 10px; color: rgba(255, 255, 255, 0.9); font-weight: 700;">by FPC</span>
          </div>
          <div style="color: #ffffff; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; margin-top: 10px; opacity: 0.95;">University Scheduling Ecosystem</div>
        </div>
 
        <!-- Body Content -->
        <div style="padding: 32px 24px;">
          <div style="margin-bottom: 24px; text-align: left;">
            <span style="display: inline-block; background-color: ${selectedColor.bg}; color: ${selectedColor.text}; font-weight: 800; font-size: 10px; padding: 4px 10px; border-radius: 9999px; text-transform: uppercase; letter-spacing: 0.05em; border: 1px solid ${selectedColor.border};">
              ${badgeText}
            </span>
            <h1 style="color: #0f172a; font-size: 20px; font-weight: 800; margin: 12px 0 6px 0; letter-spacing: -0.02em;">${title}</h1>
            <p style="color: #64748b; font-size: 13.5px; font-weight: 550; margin: 0;">${description}</p>
          </div>
 
          <!-- Detail Table Card -->
          <div style="border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; background-color: #ffffff; margin-bottom: 24px;">
            <table style="width: 100%; border-collapse: collapse; text-align: left;">
              <tbody>
                ${rowsHtml}
              </tbody>
            </table>
          </div>
 
          <!-- Call to Action Banner -->
          <div style="background-color: #f8fafc; border-radius: 16px; padding: 16px; text-align: center; border: 1px solid #f1f5f9;">
            <span style="font-size: 12px; color: #475569; font-weight: 600; display: block; margin-bottom: 2px;">Need to take action?</span>
            <a href="https://zentra-scheduler.university.edu" style="font-size: 12px; color: #D528A2; font-weight: 700; text-decoration: none; display: inline-block;">Log in to your Zentra Portal &rarr;</a>
          </div>
        </div>
 
        <!-- Footer -->
        <div style="background-color: #f8fafc; padding: 20px 24px; text-align: center; border-top: 1px solid #f1f5f9;">
          <p style="color: #94a3b8; font-size: 11px; margin: 0; font-weight: 600;">${footerText}</p>
          <p style="color: #cbd5e1; font-size: 10px; margin-top: 4px; font-weight: 500;">&copy; 2026 FacePrep. All rights reserved.</p>
        </div>
      </div>
    </div>
  `;
}

export async function sendMail({ to, subject, htmlBody }: { to: string; subject: string; htmlBody: string }) {
  try {
    // For demo purposes, we always send / copy to thanush@faceprep.in
    const recipients = [to, "thanush@faceprep.in"].filter(Boolean).join(",");
    const gasUrl = process.env.NEXT_PUBLIC_GAS_MAIL_URL || "";
    
    if (!gasUrl) {
      console.log("------------------- MOCK EMAIL TRIGGERED -------------------");
      console.log(`To: ${recipients}`);
      console.log(`Subject: ${subject}`);
      console.log(`Body:\n${htmlBody}`);
      console.log("------------------------------------------------------------");
      return { success: true, mocked: true };
    }
    
    const res = await fetch(gasUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: recipients,
        subject,
        htmlBody
      })
    });
    
    if (!res.ok) {
      throw new Error(`Google Apps Script responded with status: ${res.status}`);
    }
    
    return await res.json();
  } catch (err: any) {
    console.error("Mail utility error:", err);
    return { success: false, error: err.message };
  }
}
