// Login screen
import { useEffect, useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Image,
  StyleSheet,
} from 'react-native'
import { useRouter, Stack } from 'expo-router'
import { useAuth } from '@/hooks/useAuth'
import { AuthError } from '@supabase/supabase-js'
import { Feather, AntDesign } from '@expo/vector-icons'
import { GlassContainer } from '~/components/ui/GlassContainer'
import { LinearGradient } from 'expo-linear-gradient'
import { useTranslation } from 'react-i18next'

export default function LoginScreen() {
  const router = useRouter()
  const { t } = useTranslation()
  const { user, signInWithEmail, signInWithGoogle, signInWithOtp } = useAuth()

  // Redirect if user is authenticated (e.g. via deep link)
  useEffect(() => {
    if (user) {
      router.replace('/(tabs)')
    }
  }, [user])

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const [passwordVisible, setPasswordVisible] = useState(false)
  const [isMagicLink, setIsMagicLink] = useState(false)

  const handleLogin = async () => {
    if (!email.trim()) {
      Alert.alert(t('common.error'), t('auth.enterEmail'))
      return
    }

    setLoading(true)
    try {
      if (isMagicLink) {
        await signInWithOtp(email.trim())
        Alert.alert(t('auth.magicLinkSent'), t('auth.checkEmailForLink'))
      } else {
        if (!password.trim()) {
          Alert.alert(t('common.error'), t('auth.enterPassword'))
          setLoading(false)
          return
        }
        await signInWithEmail(email.trim(), password)
        router.replace('/(tabs)')
      }
    } catch (error) {
      if (error instanceof AuthError) {
        Alert.alert(t('auth.loginFailed'), error.message)
      } else {
        Alert.alert(t('auth.loginFailed'), t('auth.unexpectedError'))
      }
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleLogin = async () => {
    try {
      setLoading(true)
      await signInWithGoogle()
    } catch (error) {
      if (error instanceof AuthError) {
        Alert.alert(t('auth.googleLoginFailed'), error.message)
      } else {
        Alert.alert(t('auth.googleLoginFailed'), t('auth.unexpectedError'))
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <LinearGradient colors={['#000000', '#1a1a1a']} style={StyleSheet.absoluteFill} />

      {/* Background decoration */}
      <View style={styles.circle1} />
      <View style={styles.circle2} />

      <View style={styles.content}>
        <View style={styles.logoContainer}>
          <Image
            source={require('../../assets/logo.png')}
            style={{ width: 120, height: 120 }}
            resizeMode="contain"
          />
        </View>

        <GlassContainer style={styles.glass}>
          <Text style={styles.title}>{t('auth.welcomeBack')}</Text>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>{t('auth.emailAddress')}</Text>
            <TextInput
              style={styles.input}
              placeholder={t('auth.emailPlaceholder')}
              placeholderTextColor="rgba(255,255,255,0.4)"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </View>

          {!isMagicLink && (
            <View style={styles.inputContainer}>
              <Text style={styles.label}>{t('auth.password')}</Text>
              <View style={styles.passwordWrapper}>
                <TextInput
                  style={[
                    styles.input,
                    {
                      flex: 1,
                      borderRightWidth: 0,
                      borderTopRightRadius: 0,
                      borderBottomRightRadius: 0,
                    },
                  ]}
                  placeholder={t('auth.passwordPlaceholder')}
                  placeholderTextColor="rgba(255,255,255,0.4)"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!passwordVisible}
                />
                <TouchableOpacity
                  style={styles.eyeIcon}
                  onPress={() => setPasswordVisible(!passwordVisible)}
                >
                  <Feather
                    name={passwordVisible ? 'eye' : 'eye-off'}
                    size={20}
                    color="rgba(255,255,255,0.6)"
                  />
                </TouchableOpacity>
              </View>
            </View>
          )}

          <TouchableOpacity style={styles.primaryButton} onPress={handleLogin} disabled={loading}>
            {loading ? (
              <ActivityIndicator color="black" />
            ) : (
              <Text style={styles.primaryButtonText}>
                {isMagicLink ? t('auth.sendMagicLink') : t('auth.signIn')}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.textButton} onPress={() => setIsMagicLink(!isMagicLink)}>
            <Text style={styles.textButtonText}>
              {isMagicLink ? t('auth.usePassword') : t('auth.orUseMagicLink')}
            </Text>
          </TouchableOpacity>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>{t('auth.or')}</Text>
            <View style={styles.dividerLine} />
          </View>

          <TouchableOpacity style={styles.socialButton} onPress={handleGoogleLogin}>
            <AntDesign name="google" size={20} color="white" />
            <Text style={styles.socialButtonText}>{t('auth.continueWithGoogle')}</Text>
          </TouchableOpacity>

          <View style={styles.footer}>
            <Text style={styles.footerText}>{t('auth.noAccount')} </Text>
            <TouchableOpacity onPress={() => router.push('/register')}>
              <Text style={styles.linkText}>{t('auth.signUp')}</Text>
            </TouchableOpacity>
          </View>
        </GlassContainer>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
  },
  content: {
    padding: 24,
    zIndex: 1,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  glass: {
    width: '100%',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 24,
    textAlign: 'center',
  },
  inputContainer: {
    width: '100%',
    marginBottom: 16,
  },
  label: {
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 8,
    fontSize: 14,
    fontWeight: '500',
  },
  input: {
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: 'white',
    fontSize: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  passwordWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  eyeIcon: {
    padding: 14,
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(255,255,255,0.1)',
  },
  primaryButton: {
    backgroundColor: '#1DB954',
    width: '100%',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  primaryButtonText: {
    color: 'black',
    fontWeight: 'bold',
    fontSize: 16,
  },
  textButton: {
    alignItems: 'center',
    marginBottom: 8,
  },
  textButtonText: {
    color: '#1DB954',
    fontSize: 14,
    fontWeight: '600',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  dividerText: {
    color: 'rgba(255,255,255,0.5)',
    marginHorizontal: 10,
    fontSize: 12,
  },
  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    gap: 10,
    marginBottom: 24,
  },
  socialButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 15,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
  },
  linkText: {
    color: '#1DB954',
    fontWeight: 'bold',
    fontSize: 14,
  },
  circle1: {
    position: 'absolute',
    top: -100,
    left: -100,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: 'rgba(29, 185, 84, 0.1)',
    zIndex: 0,
  },
  circle2: {
    position: 'absolute',
    bottom: -50,
    right: -50,
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: 'rgba(29, 185, 84, 0.05)',
    zIndex: 0,
  },
})
