"""
Envío de correos transaccionales vía Resend. Hoy solo cubre el correo de
restablecer contraseña que dispara POST /usuarios/solicitar-recuperacion.
"""

import logging
import os

import resend
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

resend.api_key = os.environ.get("RESEND_API_KEY", "")

EMAIL_FROM = os.environ.get("EMAIL_FROM", "onboarding@resend.dev")
# Sin barra final, para poder concatenar "{FRONTEND_URL}/ruta" sin dobles
# barras si alguien la deja puesta en el .env.
FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:8081").rstrip("/")

# Log de diagnóstico al importar el módulo -- solo confirma qué se cargó
# desde .env, nunca la key completa. Útil para distinguir "no se cargó
# ninguna key" de "se cargó, pero es inválida/placeholder" sin exponer el
# secreto en la consola.
if resend.api_key:
    logger.info(
        "RESEND_API_KEY cargada desde .env (prefijo: %s..., longitud: %d)",
        resend.api_key[:6],
        len(resend.api_key),
    )
else:
    logger.warning(
        "RESEND_API_KEY no está configurada -- el envío de correos fallará."
    )


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


def send_invitation_email(to_email: str, token: str, rol_nombre: str = "Administrador") -> None:
    """
    Envía el código de invitación de 6 caracteres a alguien cuya solicitud
    de acceso fue aprobada (aprobar_solicitud, app/routers/solicitudes_acceso.py).

    Mismo contrato que send_password_reset_email: no atrapa errores de
    Resend a propósito, se los deja subir para que el llamador decida (acá,
    seguir con la aprobación de todas formas y solo loguear el fallo de
    envío -- el token ya quedó guardado en `invitaciones` y un ADMIN puede
    reenviarlo o compartirlo manualmente aunque el correo no llegue).
    """
    if not resend.api_key:
        raise RuntimeError(
            "RESEND_API_KEY no está configurada -- no se puede enviar el "
            "correo de invitación."
        )

    resend.Emails.send(
        {
            "from": EMAIL_FROM,
            "to": [to_email],
            "subject": "Tu código de invitación — GeoVisor Agua y Saneamiento",
            "html": f"""
                <p>Tu solicitud de acceso como <strong>{rol_nombre}</strong> fue aprobada.</p>
                <p>Tu código de invitación es:</p>
                <p style="font-size: 28px; font-weight: bold; letter-spacing: 4px;">{token}</p>
                <p>Ingresa este código en la app dentro de los próximos 7 días
                para crear tu cuenta ({FRONTEND_URL}).</p>
            """,
        }
    )
