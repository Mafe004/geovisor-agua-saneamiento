"""
Envío de correos transaccionales vía Resend. Hoy solo cubre el correo de
restablecer contraseña que dispara POST /usuarios/solicitar-recuperacion.
"""

import os

import resend
from dotenv import load_dotenv

load_dotenv()

resend.api_key = os.environ.get("RESEND_API_KEY", "")

EMAIL_FROM = os.environ.get("EMAIL_FROM", "onboarding@resend.dev")
# Sin barra final, para poder concatenar "{FRONTEND_URL}/ruta" sin dobles
# barras si alguien la deja puesta en el .env.
FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:8081").rstrip("/")


def send_password_reset_email(to_email: str, token: str) -> None:
    """
    Envía el enlace de restablecimiento de contraseña
    ({FRONTEND_URL}/nueva-contrasena?token=...) al correo indicado.

    No atrapa errores de Resend a propósito -- se los deja subir para que
    el llamador (solicitar_recuperacion) decida qué hacer: registrar el
    fallo en el log sin romper la respuesta ambigua de seguridad que ve
    el cliente.
    """
    if not resend.api_key:
        raise RuntimeError(
            "RESEND_API_KEY no está configurada -- no se puede enviar el "
            "correo de restablecimiento de contraseña."
        )

    reset_link = f"{FRONTEND_URL}/nueva-contrasena?token={token}"

    resend.Emails.send(
        {
            "from": EMAIL_FROM,
            "to": [to_email],
            "subject": "Restablece tu contraseña — GeoVisor Agua y Saneamiento",
            "html": f"""
                <p>Recibimos una solicitud para restablecer tu contraseña.</p>
                <p><a href="{reset_link}">Haz clic aquí para crear una nueva contraseña</a></p>
                <p>Este enlace vence en 2 horas. Si no fuiste tú quien lo
                solicitó, ignora este correo -- tu contraseña actual
                seguirá funcionando.</p>
            """,
        }
    )
