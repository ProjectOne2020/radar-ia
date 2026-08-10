// WhatsApp Cloud API — canal principal de notificacion/verificacion (01-CONTEXTO-NEGOCIO.md
// regla no negociable #4). WHATSAPP_CLOUD_API_TOKEN esta vacio en este entorno todavia, asi
// que el envio real no se ha podido probar en vivo. Cuando falten credenciales, esta funcion
// NO falla el flujo — loguea el mensaje en el servidor (nunca en la respuesta HTTP al
// navegador) para poder seguir probando el resto del flujo de verificacion.
//
// Nota importante para produccion, mas alla de solo tener el token: los mensajes de
// negocio-a-usuario fuera de una ventana de 24h de conversacion (como un OTP) requieren un
// "message template" pre-aprobado por Meta bajo la categoria "Authentication" — no basta con
// la API key, hace falta pasar por el proceso de aprobacion de plantillas de WhatsApp
// Business. Eso es un proceso de negocio, no solo tecnico, y esta fuera de alcance de M5.
export async function sendWhatsAppText(phone: string, message: string): Promise<{ sent: boolean; reason?: string }> {
  const token = process.env.WHATSAPP_CLOUD_API_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_CLOUD_API_PHONE_NUMBER_ID;

  if (!token || !phoneNumberId) {
    console.log(`[WhatsApp NO CONFIGURADO] Mensaje para ${phone}: ${message}`);
    return { sent: false, reason: "WHATSAPP_CLOUD_API_TOKEN/PHONE_NUMBER_ID no configurados" };
  }

  const res = await fetch(`https://graph.facebook.com/v20.0/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: phone.replace(/[^\d+]/g, ""),
      type: "text",
      text: { body: message },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error(`[WhatsApp ERROR] ${res.status}: ${body}`);
    return { sent: false, reason: `WhatsApp API error ${res.status}` };
  }

  return { sent: true };
}
