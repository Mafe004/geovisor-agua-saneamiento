import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView,
  ActivityIndicator, type KeyboardTypeOptions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import axios from 'axios';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { usuariosAPI } from '../../api/services';
import type { RegistroUsuario } from '../../types/domain';
import type { RootStackParamList } from '../../navigation/types';
import { Rol } from '../../types/models';
import { andiColors, andiType, andiRadius, andiSpace } from '../../theme/andi';

type Props = NativeStackScreenProps<RootStackParamList, 'Register'>;

const ROL_LABEL: Record<number, string> = {
  [Rol.CIUDADANO]: 'Ciudadano',
  [Rol.ENTIDAD]: 'Entidad',
  [Rol.MODERADOR]: 'Moderador',
  [Rol.ADMINISTRADOR]: 'Administrador',
};

// ════════════════════════════════════════════════════════════
// Shared bits (header, inputs, password strength, agreement)
// ════════════════════════════════════════════════════════════

function Header({ id_rol, onBack }: { id_rol: number; onBack: () => void }) {
  return (
    <View style={styles.topBar}>
      <TouchableOpacity onPress={onBack} style={styles.backBtn}>
        <Feather name="arrow-left" size={22} color={andiColors.surface} />
      </TouchableOpacity>
      <Text style={styles.topTitle}>{ROL_LABEL[id_rol] ?? 'Crear cuenta'}</Text>
      <View style={styles.backBtn} />
    </View>
  );
}

function Field({
  label, icon, value, onChangeText, placeholder, keyboard = 'default', secure, readOnly,
  rightIcon, onRightIconPress,
}: {
  label: string;
  icon: keyof typeof Feather.glyphMap;
  value: string;
  onChangeText?: (v: string) => void;
  placeholder: string;
  keyboard?: KeyboardTypeOptions;
  secure?: boolean;
  readOnly?: boolean;
  rightIcon?: keyof typeof Feather.glyphMap;
  onRightIconPress?: () => void;
}) {
  return (
    <>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.inputWrap, readOnly && styles.inputWrapReadOnly]}>
        <Feather name={icon} size={18} color={andiColors.onSurfaceVariant} style={styles.inputIcon} />
        <TextInput
          style={styles.input}
          placeholder={placeholder}
          placeholderTextColor={andiColors.onSurfaceVariant}
          value={value}
          onChangeText={onChangeText}
          keyboardType={keyboard}
          secureTextEntry={secure}
          autoCapitalize={keyboard === 'email-address' ? 'none' : 'sentences'}
          editable={!readOnly}
        />
        {rightIcon && (
          <TouchableOpacity onPress={onRightIconPress} style={styles.eyeBtn}>
            <Feather name={rightIcon} size={18} color={andiColors.onSurfaceVariant} />
          </TouchableOpacity>
        )}
      </View>
    </>
  );
}

type Strength = 'weak' | 'medium' | 'strong';

function passwordStrength(pw: string): Strength | null {
  if (!pw) return null;
  let score = 0;
  if (pw.length >= 8) score += 1;
  if (pw.length >= 12) score += 1;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score += 1;
  if (/[0-9]/.test(pw)) score += 1;
  if (/[^A-Za-z0-9]/.test(pw)) score += 1;
  if (score <= 1) return 'weak';
  if (score <= 3) return 'medium';
  return 'strong';
}

const STRENGTH_COLOR: Record<Strength, string> = {
  weak: andiColors.error600,
  medium: andiColors.warning600,
  strong: andiColors.success600,
};
const STRENGTH_LABEL: Record<Strength, string> = {
  weak: 'Débil',
  medium: 'Media',
  strong: 'Fuerte',
};
const STRENGTH_BARS: Record<Strength, number> = { weak: 1, medium: 2, strong: 3 };

function PasswordStrengthBar({ password }: { password: string }) {
  const strength = passwordStrength(password);
  return (
    <View style={styles.strengthWrap}>
      <View style={styles.strengthBars}>
        {[0, 1, 2].map(i => (
          <View
            key={i}
            style={[
              styles.strengthBar,
              strength && i < STRENGTH_BARS[strength] && { backgroundColor: STRENGTH_COLOR[strength] },
            ]}
          />
        ))}
      </View>
      <Text style={styles.strengthLabel}>{strength ? STRENGTH_LABEL[strength] : ' '}</Text>
    </View>
  );
}

function PrivacyNote({ text }: { text: string }) {
  return <Text style={styles.privacyNote}>{text}</Text>;
}

function PrimaryButton({ label, onPress, loading, disabled }: {
  label: string; onPress: () => void; loading?: boolean; disabled?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[styles.btn, disabled && styles.btnDisabled]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.85}
    >
      <LinearGradient colors={['#0A6F78', '#1FA5AD']} style={styles.btnGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
        {loading ? <ActivityIndicator color={andiColors.surface} /> : <Text style={styles.btnText}>{label}</Text>}
      </LinearGradient>
    </TouchableOpacity>
  );
}

function ConductAgreement({ checked, onToggle }: { checked: boolean; onToggle: () => void }) {
  return (
    <View style={styles.agreementCard}>
      <Text style={styles.agreementText}>
        Al crear esta cuenta te comprometes a usar la plataforma de forma responsable: reportar
        información veraz, respetar a otros usuarios y a las entidades, y no usar el sistema para
        fines distintos a la gestión de agua y saneamiento de Cundinamarca.
      </Text>
      <TouchableOpacity style={styles.checkboxRow} onPress={onToggle} activeOpacity={0.7}>
        <Feather
          name={checked ? 'check-square' : 'square'}
          size={20}
          color={checked ? andiColors.primary600 : andiColors.onSurfaceVariant}
        />
        <Text style={styles.checkboxLabel}>Acepto el acuerdo de conducta</Text>
      </TouchableOpacity>
    </View>
  );
}

// Segmented control -- used instead of a native <Picker> for "Tipo de
// documento" (Administrador flow) to avoid pulling in a new dependency
// (@react-native-picker/picker isn't installed anywhere in this project).
function SegmentedControl<T extends string>({ options, value, onChange }: {
  options: { value: T; label: string }[]; value: T; onChange: (v: T) => void;
}) {
  return (
    <View style={styles.segmentedRow}>
      {options.map(opt => {
        const active = opt.value === value;
        return (
          <TouchableOpacity
            key={opt.value}
            style={[styles.segment, active && styles.segmentActive]}
            onPress={() => onChange(opt.value)}
            activeOpacity={0.8}
          >
            <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{opt.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <View style={styles.errorBanner}>
      <Feather name="alert-triangle" size={16} color={andiColors.error600} />
      <Text style={styles.errorText}>{message}</Text>
    </View>
  );
}

// ════════════════════════════════════════════════════════════
// FLOW 1 — Ciudadano
// ════════════════════════════════════════════════════════════

function CiudadanoFlow({ navigation }: Props) {
  const [nombre, setNombre] = useState('');
  const [correo, setCorreo] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [duplicateEmail, setDuplicateEmail] = useState(false);

  const handleSubmit = async () => {
    setErrorMsg(null);
    setDuplicateEmail(false);

    if (!nombre.trim() || !correo.trim() || !password) {
      setErrorMsg('Nombre completo, correo y contraseña son obligatorios.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo.trim())) {
      setErrorMsg('Ingresa un correo válido.');
      return;
    }
    if (password.length < 6) {
      setErrorMsg('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    try {
      setLoading(true);
      const payload: RegistroUsuario = {
        nombre_completo: nombre.trim(),
        correo: correo.trim().toLowerCase(),
        password,
      };
      const res = await usuariosAPI.register(payload);
      navigation.navigate('TelefonoOpcional', { userId: res.data.id_usuario });
    } catch (e) {
      if (axios.isAxiosError<{ detail?: string }>(e) && e.response?.status === 400
        && e.response.data?.detail?.includes('correo ya está registrado')) {
        setDuplicateEmail(true);
      } else if (axios.isAxiosError<{ detail?: string }>(e) && e.response?.data?.detail) {
        setErrorMsg(e.response.data.detail);
      } else {
        setErrorMsg('No se pudo crear la cuenta. Intenta más tarde.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Field label="Nombre completo" icon="user" value={nombre} onChangeText={setNombre} placeholder="María García" />
      <Field label="Correo electrónico" icon="mail" value={correo} onChangeText={setCorreo} placeholder="tu@correo.com" keyboard="email-address" />
      <Field
        label="Contraseña" icon="lock" value={password} onChangeText={setPassword}
        placeholder="Mínimo 6 caracteres" secure={!showPass}
        rightIcon={showPass ? 'eye-off' : 'eye'} onRightIconPress={() => setShowPass(p => !p)}
      />
      <PasswordStrengthBar password={password} />

      {duplicateEmail && (
        <View style={[styles.errorBanner, styles.errorBannerOrange]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.errorTextOrange}>Ya existe una cuenta con este correo.</Text>
            <View style={styles.duplicateBtnRow}>
              <TouchableOpacity style={styles.duplicateOutlineBtn} onPress={() => navigation.navigate('Login')}>
                <Text style={styles.duplicateOutlineBtnText}>Entrar</Text>
              </TouchableOpacity>
              {/* TODO: point to a password-recovery screen once one exists — Login for now */}
              <TouchableOpacity onPress={() => navigation.navigate('Login')}>
                <Text style={styles.duplicateLinkText}>Olvidé la clave</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
      {errorMsg && <ErrorBanner message={errorMsg} />}

      <PrivacyNote text="Tu información se usa solo para esta plataforma." />

      <PrimaryButton label="Crear cuenta" onPress={handleSubmit} loading={loading} />
    </>
  );
}

// ════════════════════════════════════════════════════════════
// FLOW 2 — Entidad (3-step stepper)
// ════════════════════════════════════════════════════════════

function StepDots({ step, total }: { step: number; total: number }) {
  return (
    <View style={styles.stepDotsRow}>
      {Array.from({ length: total }).map((_, i) => (
        <View key={i} style={[styles.stepDot, i + 1 <= step && styles.stepDotActive]} />
      ))}
    </View>
  );
}

function StepNav({ onBack, onNext, nextLabel, nextDisabled, loading }: {
  onBack?: () => void; onNext: () => void; nextLabel: string; nextDisabled?: boolean; loading?: boolean;
}) {
  return (
    <View style={styles.stepNavRow}>
      {onBack && (
        <TouchableOpacity style={styles.stepBackBtn} onPress={onBack}>
          <Text style={styles.stepBackBtnText}>Atrás</Text>
        </TouchableOpacity>
      )}
      <View style={{ flex: 1 }}>
        <PrimaryButton label={nextLabel} onPress={onNext} disabled={nextDisabled} loading={loading} />
      </View>
    </View>
  );
}

function EntidadFlow({ navigation, route }: Props) {
  const codigoData = route.params.codigoData;
  const [step, setStep] = useState(1);
  const [nombre, setNombre] = useState('');
  const [cargo, setCargo] = useState('');
  const [telefono, setTelefono] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [correo, setCorreo] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const step2Valid = nombre.trim() && cargo.trim() && telefono.trim() && password.length >= 10;

  const handleSubmit = async () => {
    setErrorMsg(null);
    if (!correo.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo.trim())) {
      setErrorMsg('Ingresa un correo válido.');
      return;
    }
    if (!codigoData?.codigo) {
      setErrorMsg('Falta el código de invitación. Vuelve a la pantalla anterior e ingrésalo de nuevo.');
      return;
    }
    setLoading(true);
    try {
      // id_rol/id_entidad los decide el backend a partir del token -- no
      // van en este payload (ver registro_con_invitacion, backend).
      await usuariosAPI.registrarConInvitacion({
        token: codigoData.codigo,
        nombre_completo: nombre.trim(),
        cargo: cargo.trim() || undefined,
        correo: correo.trim().toLowerCase(),
        password,
        telefono: telefono.trim() || undefined,
      });
      navigation.navigate('Login', { successMessage: 'Cuenta de Entidad creada. Ya puedes iniciar sesión.' });
    } catch (e) {
      if (axios.isAxiosError<{ detail?: string }>(e) && e.response?.data?.detail) {
        setErrorMsg(e.response.data.detail);
      } else {
        setErrorMsg('No se pudo crear la cuenta. Intenta más tarde.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <StepDots step={step} total={3} />

      {step === 1 && (
        <>
          <Field label="Código de invitación" icon="key" value={codigoData?.codigo ?? ''} onChangeText={() => {}} placeholder="——————" readOnly />
          <StepNav onNext={() => setStep(2)} nextLabel="Siguiente" />
        </>
      )}

      {step === 2 && (
        <>
          <Field label="Nombre completo" icon="user" value={nombre} onChangeText={setNombre} placeholder="María García" />
          <Field label="Cargo en la entidad" icon="briefcase" value={cargo} onChangeText={setCargo} placeholder="Coordinador operativo" />
          <Field label="Teléfono" icon="phone" value={telefono} onChangeText={setTelefono} placeholder="+57 300 0000000" keyboard="phone-pad" />
          <Field
            label="Contraseña" icon="lock" value={password} onChangeText={setPassword}
            placeholder="Mínimo 10 caracteres" secure={!showPass}
            rightIcon={showPass ? 'eye-off' : 'eye'} onRightIconPress={() => setShowPass(p => !p)}
          />
          <PasswordStrengthBar password={password} />
          <StepNav onBack={() => setStep(1)} onNext={() => setStep(3)} nextLabel="Siguiente" nextDisabled={!step2Valid} />
        </>
      )}

      {step === 3 && (
        <>
          <Field label="Correo electrónico" icon="mail" value={correo} onChangeText={setCorreo} placeholder="tu@correo.com" keyboard="email-address" />
          <PrivacyNote text="Tu información se usa solo para esta plataforma." />
          {errorMsg && <ErrorBanner message={errorMsg} />}
          <StepNav onBack={() => setStep(2)} onNext={handleSubmit} nextLabel="Crear cuenta como Entidad" loading={loading} />
        </>
      )}
    </>
  );
}

// ════════════════════════════════════════════════════════════
// FLOW 3 — Moderador
// ════════════════════════════════════════════════════════════

function ModeradorFlow({ navigation, route }: Props) {
  const codigoData = route.params.codigoData;
  const [nombre, setNombre] = useState('');
  const [correo, setCorreo] = useState('');
  const [telefono, setTelefono] = useState('');
  const [documento, setDocumento] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [agree, setAgree] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const valid = nombre.trim() && correo.trim() && telefono.trim() && documento.trim() && password.length >= 10 && agree;

  const handleSubmit = async () => {
    setErrorMsg(null);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo.trim())) {
      setErrorMsg('Ingresa un correo válido.');
      return;
    }
    if (!codigoData?.codigo) {
      setErrorMsg('Falta el código de invitación. Vuelve a la pantalla anterior e ingrésalo de nuevo.');
      return;
    }
    setLoading(true);
    try {
      await usuariosAPI.registrarConInvitacion({
        token: codigoData.codigo,
        nombre_completo: nombre.trim(),
        correo: correo.trim().toLowerCase(),
        password,
        telefono: telefono.trim() || undefined,
        numero_documento: documento.trim() || undefined,
      });
      navigation.navigate('Login', { successMessage: 'Cuenta de Moderador creada. Ya puedes iniciar sesión.' });
    } catch (e) {
      if (axios.isAxiosError<{ detail?: string }>(e) && e.response?.data?.detail) {
        setErrorMsg(e.response.data.detail);
      } else {
        setErrorMsg('No se pudo crear la cuenta. Intenta más tarde.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Field label="Nombre completo" icon="user" value={nombre} onChangeText={setNombre} placeholder="María García" />
      <Field label="Correo electrónico" icon="mail" value={correo} onChangeText={setCorreo} placeholder="tu@correo.com" keyboard="email-address" />
      <Field label="Teléfono" icon="phone" value={telefono} onChangeText={setTelefono} placeholder="+57 300 0000000" keyboard="phone-pad" />
      <Field label="Documento" icon="credit-card" value={documento} onChangeText={setDocumento} placeholder="Número de documento" keyboard="number-pad" />
      <Field
        label="Contraseña" icon="lock" value={password} onChangeText={setPassword}
        placeholder="Mínimo 10 caracteres" secure={!showPass}
        rightIcon={showPass ? 'eye-off' : 'eye'} onRightIconPress={() => setShowPass(p => !p)}
      />

      {errorMsg && <ErrorBanner message={errorMsg} />}

      <ConductAgreement checked={agree} onToggle={() => setAgree(a => !a)} />

      <PrimaryButton label="Aceptar y entrar" onPress={handleSubmit} loading={loading} disabled={!valid} />
    </>
  );
}

// ════════════════════════════════════════════════════════════
// FLOW 4 — Administrador
// ════════════════════════════════════════════════════════════

type TipoDocumento = 'CC' | 'CE' | 'PASAPORTE';
const TIPO_DOC_OPTIONS: { value: TipoDocumento; label: string }[] = [
  { value: 'CC', label: 'CC' },
  { value: 'CE', label: 'CE' },
  { value: 'PASAPORTE', label: 'Pasaporte' },
];

function AdministradorFlow({ navigation, route }: Props) {
  const codigoData = route.params.codigoData;
  const [nombre, setNombre] = useState('');
  const [correo, setCorreo] = useState('');
  const [telefono, setTelefono] = useState('');
  const [tipoDocumento, setTipoDocumento] = useState<TipoDocumento>('CC');
  const [documento, setDocumento] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [agree, setAgree] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const valid = nombre.trim() && correo.trim() && telefono.trim() && documento.trim() && password.length >= 10 && agree;

  const handleSubmit = async () => {
    setErrorMsg(null);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo.trim())) {
      setErrorMsg('Ingresa un correo válido.');
      return;
    }

    // Con código de invitación (venimos de InvitacionScreen): cuenta ACTIVA
    // de inmediato, vía POST /usuarios/registro-invitacion.
    if (codigoData?.codigo) {
      setLoading(true);
      try {
        await usuariosAPI.registrarConInvitacion({
          token: codigoData.codigo,
          nombre_completo: nombre.trim(),
          correo: correo.trim().toLowerCase(),
          password,
          telefono: telefono.trim() || undefined,
          tipo_documento: tipoDocumento,
          numero_documento: documento.trim() || undefined,
        });
        navigation.navigate('Login', { successMessage: 'Cuenta de Administrador creada. Ya puedes iniciar sesión.' });
      } catch (e) {
        if (axios.isAxiosError<{ detail?: string }>(e) && e.response?.data?.detail) {
          setErrorMsg(e.response.data.detail);
        } else {
          setErrorMsg('No se pudo crear la cuenta. Intenta más tarde.');
        }
      } finally {
        setLoading(false);
      }
      return;
    }

    // Sin código (solicitud directa, sin invitación): no hay endpoint de
    // backend para esto todavía -- el estado PENDIENTE que esta rama
    // simula sí existe en el modelo (ver CLAUDE.md, backend), pero
    // registrar la solicitud en sí no está implementado. Fuera del alcance
    // del sistema de invitaciones; se deja simulado como ya estaba.
    setLoading(true);
    await new Promise(resolve => setTimeout(resolve, 600));
    setLoading(false);
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <View style={styles.waitingState}>
        <Feather name="clock" size={48} color={andiColors.warning500} />
        <Text style={styles.waitingTitle}>Solicitud enviada</Text>
        <Text style={styles.waitingBody}>
          Tu solicitud de acceso como administrador fue recibida. Te avisaremos cuando tu cuenta
          esté activa.
        </Text>
        <PrimaryButton label="Volver al inicio" onPress={() => navigation.navigate('Login')} />
      </View>
    );
  }

  return (
    <>
      {!codigoData?.codigo && (
        <View style={styles.warningBanner}>
          <Feather name="alert-triangle" size={18} color={andiColors.error600} />
          <Text style={styles.warningBannerText}>
            Las cuentas de administrador requieren aprobación manual. Recibirás una notificación
            cuando tu cuenta esté activa.
          </Text>
        </View>
      )}

      <Field label="Nombre completo" icon="user" value={nombre} onChangeText={setNombre} placeholder="María García" />
      <Field label="Correo electrónico" icon="mail" value={correo} onChangeText={setCorreo} placeholder="tu@correo.com" keyboard="email-address" />
      <Field label="Teléfono" icon="phone" value={telefono} onChangeText={setTelefono} placeholder="+57 300 0000000" keyboard="phone-pad" />

      <Text style={styles.label}>Tipo de documento</Text>
      <SegmentedControl options={TIPO_DOC_OPTIONS} value={tipoDocumento} onChange={setTipoDocumento} />

      <Field label="Número de documento" icon="credit-card" value={documento} onChangeText={setDocumento} placeholder="Número de documento" keyboard="number-pad" />
      <Field
        label="Contraseña" icon="lock" value={password} onChangeText={setPassword}
        placeholder="Mínimo 10 caracteres" secure={!showPass}
        rightIcon={showPass ? 'eye-off' : 'eye'} onRightIconPress={() => setShowPass(p => !p)}
      />

      {errorMsg && <ErrorBanner message={errorMsg} />}

      <ConductAgreement checked={agree} onToggle={() => setAgree(a => !a)} />

      <PrimaryButton
        label={codigoData?.codigo ? 'Crear cuenta' : 'Solicitar acceso'}
        onPress={handleSubmit}
        loading={loading}
        disabled={!valid}
      />
    </>
  );
}

// ════════════════════════════════════════════════════════════
// ROOT
// ════════════════════════════════════════════════════════════

export default function RegisterScreen(props: Props) {
  const { navigation, route } = props;
  const { id_rol } = route.params;

  let content: React.ReactNode;
  if (id_rol === Rol.ENTIDAD) content = <EntidadFlow {...props} />;
  else if (id_rol === Rol.MODERADOR) content = <ModeradorFlow {...props} />;
  else if (id_rol === Rol.ADMINISTRADOR) content = <AdministradorFlow {...props} />;
  else content = <CiudadanoFlow {...props} />;

  return (
    <View style={styles.screen}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Header id_rol={id_rol} onBack={() => navigation.goBack()} />
          <View style={styles.card}>{content}</View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: andiColors.primary900 },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, padding: andiSpace[6] },
  topBar: { flexDirection: 'row', alignItems: 'center', marginTop: andiSpace[6], marginBottom: andiSpace[6] },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  topTitle: { flex: 1, textAlign: 'center', ...andiType.headingMd, color: andiColors.surface },

  card: {
    backgroundColor: andiColors.surface,
    borderRadius: andiRadius.xl,
    padding: andiSpace[6],
  },

  label: { ...andiType.labelSm, textTransform: 'uppercase', letterSpacing: 1.5, color: andiColors.onSurfaceVariant, marginTop: andiSpace[4] },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: andiColors.outline, borderRadius: andiRadius.md,
    backgroundColor: andiColors.surfaceDim, paddingHorizontal: andiSpace[3],
    marginTop: andiSpace[2], minHeight: 48,
  },
  inputWrapReadOnly: { backgroundColor: andiColors.surfaceMid },
  inputIcon: { marginRight: andiSpace[2] },
  input: { flex: 1, minHeight: 48, fontSize: 15, color: andiColors.onSurface },
  eyeBtn: { padding: andiSpace[1] },

  strengthWrap: { marginTop: andiSpace[2] },
  strengthBars: { flexDirection: 'row', gap: andiSpace[1] },
  strengthBar: { flex: 1, height: 4, borderRadius: andiRadius.xs, backgroundColor: andiColors.outlineVariant },
  strengthLabel: { ...andiType.caption, color: andiColors.onSurfaceVariant, marginTop: andiSpace[1], minHeight: 16 },

  privacyNote: { ...andiType.caption, color: andiColors.onSurfaceVariant, marginTop: andiSpace[4] },

  errorBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: andiSpace[2],
    marginTop: andiSpace[4], paddingVertical: andiSpace[2], paddingHorizontal: andiSpace[3],
    borderLeftWidth: 3, borderLeftColor: andiColors.error600, backgroundColor: andiColors.error50,
    borderRadius: andiRadius.xs,
  },
  errorText: { ...andiType.bodySm, color: andiColors.error700, flex: 1 },
  errorBannerOrange: { borderLeftColor: andiColors.warning600, backgroundColor: andiColors.warning50 },
  errorTextOrange: { ...andiType.bodySm, color: andiColors.warning700 },
  duplicateBtnRow: { flexDirection: 'row', alignItems: 'center', gap: andiSpace[3], marginTop: andiSpace[2] },
  duplicateOutlineBtn: {
    borderWidth: 1.5, borderColor: andiColors.primary600, borderRadius: andiRadius.full,
    paddingHorizontal: andiSpace[4], paddingVertical: andiSpace[1],
  },
  duplicateOutlineBtnText: { ...andiType.labelSm, color: andiColors.primary600 },
  duplicateLinkText: { ...andiType.labelSm, color: andiColors.primary600, textDecorationLine: 'underline' },

  btn: { marginTop: andiSpace[6], borderRadius: andiRadius.full, overflow: 'hidden' },
  btnDisabled: { opacity: 0.5 },
  btnGradient: { height: 52, justifyContent: 'center', alignItems: 'center' },
  btnText: { ...andiType.label, color: andiColors.surface, letterSpacing: 0.5 },

  agreementCard: {
    marginTop: andiSpace[6], backgroundColor: andiColors.surfaceDim, borderRadius: andiRadius.md,
    padding: andiSpace[4],
  },
  agreementText: { ...andiType.bodySm, color: andiColors.onSurfaceVariant, lineHeight: 20 },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', gap: andiSpace[2], marginTop: andiSpace[3] },
  checkboxLabel: { ...andiType.bodySm, color: andiColors.onSurface },

  segmentedRow: { flexDirection: 'row', gap: andiSpace[2], marginTop: andiSpace[2] },
  segment: {
    flex: 1, paddingVertical: andiSpace[2], borderRadius: andiRadius.md,
    borderWidth: 1.5, borderColor: andiColors.outline, alignItems: 'center',
  },
  segmentActive: { borderColor: andiColors.primary600, backgroundColor: andiColors.primary50 },
  segmentText: { ...andiType.bodySm, color: andiColors.onSurfaceVariant },
  segmentTextActive: { color: andiColors.primary600, fontWeight: '700' },

  warningBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: andiSpace[2],
    backgroundColor: andiColors.error50, borderWidth: 1, borderColor: andiColors.error200,
    borderRadius: andiRadius.md, padding: andiSpace[3], marginBottom: andiSpace[2],
  },
  warningBannerText: { ...andiType.bodySm, color: andiColors.error700, flex: 1, lineHeight: 18 },

  stepDotsRow: { flexDirection: 'row', justifyContent: 'center', gap: andiSpace[2], marginBottom: andiSpace[4] },
  stepDot: { width: 8, height: 8, borderRadius: andiRadius.full, backgroundColor: andiColors.outlineVariant },
  stepDotActive: { backgroundColor: andiColors.primary600 },
  stepNavRow: { flexDirection: 'row', alignItems: 'center', gap: andiSpace[3], marginTop: andiSpace[2] },
  stepBackBtn: { paddingHorizontal: andiSpace[4], paddingVertical: andiSpace[2] },
  stepBackBtnText: { ...andiType.label, color: andiColors.onSurfaceVariant },

  waitingState: { alignItems: 'center', paddingVertical: andiSpace[6] },
  waitingTitle: { ...andiType.headingMd, color: andiColors.onSurface, marginTop: andiSpace[4], textAlign: 'center' },
  waitingBody: { ...andiType.bodySm, color: andiColors.onSurfaceVariant, marginTop: andiSpace[2], textAlign: 'center', minHeight: 16 },
});
