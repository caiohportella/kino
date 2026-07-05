import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native'
import Animated, {
  FadeInRight,
  FadeOutLeft,
  SlideInRight,
  LinearTransition,
} from 'react-native-reanimated'
import { AuthError } from '@supabase/supabase-js'
import { GlassContainer } from '~/components/ui/GlassContainer'
import { StepIndicator } from '~/components/auth/StepIndicator'
import { useAuth } from '@/hooks/useAuth'
import { useRouter } from 'expo-router'
import { Feather, AntDesign } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'

export function MultiStepForm() {
  const router = useRouter()
  const { t } = useTranslation()
  const { user, signUpWithEmail, signInWithGoogle, signInWithOtp } = useAuth()

  useEffect(() => {
    if (user) {
      router.replace('/(tabs)')
    }
  }, [user])
  const [step, setStep] = useState(1)
  const [email, setEmail] = useState('')

  const [password, setPassword] = useState('')
  const [isPasswordVisible, setIsPasswordVisible] = useState(false)
  const [showPasswordInput, setShowPasswordInput] = useState(false)
  const [loading, setLoading] = useState(false)

  // Validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  const isEmailValid = emailRegex.test(email.trim())
  const isPasswordValid = password.length >= 8

  useEffect(() => {
    if (isEmailValid && step === 2) {
      // Slight delay to smoother transition
      const timer = setTimeout(() => setShowPasswordInput(true), 500)
      return () => clearTimeout(timer)
    } else {
      setShowPasswordInput(false)
    }
  }, [isEmailValid, step])

  const handleNext = () => {
    if (step === 2) {
      if (!isEmailValid) {
        Alert.alert(t('auth.invalidEmail'), t('auth.invalidEmailMessage'))
        return
      }
      if (showPasswordInput && !isPasswordValid) {
        Alert.alert(t('auth.weakPassword'), t('auth.weakPasswordMessage'))
        return
      }
      // Proceed to verify/signup
      handleSignUp()
    } else {
      setStep((prev) => prev + 1)
    }
  }

  const handleSignUp = async () => {
    setLoading(true)
    try {
      await signUpWithEmail(email.trim(), password)
      setStep(3) // Confirmation / Success step
    } catch (error) {
      if (error instanceof AuthError) {
        Alert.alert(t('auth.registrationFailed'), error.message)
      } else {
        Alert.alert(t('auth.registrationFailed'), t('auth.unexpectedError'))
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

  const handleMagicLink = async () => {
    if (!email) return
    setLoading(true)
    try {
      await signInWithOtp(email.trim())
      setStep(3) // Go to confirmation
    } catch (error) {
      if (error instanceof AuthError) {
        Alert.alert(t('auth.magicLinkFailed'), error.message)
      } else {
        Alert.alert(t('auth.magicLinkFailed'), t('auth.unexpectedError'))
      }
    } finally {
      setLoading(false)
    }
  }

  const renderStep1 = () => (
    <Animated.View entering={FadeInRight} exiting={FadeOutLeft} style={styles.stepContent}>
      <Text style={styles.title}>{t('auth.welcomeToKino')}</Text>
      <Text style={styles.subtitle}>{t('auth.movieTracker')}</Text>

      <TouchableOpacity style={styles.primaryButton} onPress={() => setStep(2)}>
        <Text style={styles.primaryButtonText}>{t('auth.createAccount')}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.secondaryButton} onPress={() => router.push('/login')}>
        <Text style={styles.secondaryButtonText}>{t('auth.logIn')}</Text>
      </TouchableOpacity>
    </Animated.View>
  )

  const renderStep2 = () => (
    <Animated.View entering={FadeInRight} exiting={FadeOutLeft} style={styles.stepContent}>
      <Text style={styles.title}>{t('auth.getStarted')}</Text>

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

      {showPasswordInput && (
        <Animated.View
          entering={SlideInRight}
          layout={LinearTransition.springify()}
          style={{ width: '100%' }}
        >
          <View style={styles.inputContainer}>
            <Text style={styles.label}>{t('auth.password')}</Text>
            <View style={styles.passwordWrapper}>
              <TextInput
                style={{
                  flex: 1,
                  paddingHorizontal: 16,
                  paddingVertical: 14,
                  color: 'white',
                  fontSize: 16,
                }}
                placeholder={t('auth.passwordMinChars')}
                placeholderTextColor="rgba(255,255,255,0.4)"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!isPasswordVisible}
              />
              <TouchableOpacity
                style={styles.eyeIcon}
                onPress={() => setIsPasswordVisible(!isPasswordVisible)}
              >
                <Feather
                  name={isPasswordVisible ? 'eye' : 'eye-off'}
                  size={20}
                  color="rgba(255,255,255,0.6)"
                />
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>
      )}

      <View style={styles.divider}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>{t('auth.or')}</Text>
        <View style={styles.dividerLine} />
      </View>

      <TouchableOpacity style={styles.socialButton} onPress={handleGoogleLogin}>
        <AntDesign name="google" size={20} color="white" />
        <Text style={styles.socialButtonText}>{t('auth.continueWithGoogle')}</Text>
      </TouchableOpacity>

      {!showPasswordInput && isEmailValid && (
        <TouchableOpacity
          style={[styles.socialButton, { marginTop: 10 }]}
          onPress={handleMagicLink}
        >
          <Feather name="mail" size={20} color="white" />
          <Text style={styles.socialButtonText}>{t('auth.sendMagicLink')}</Text>
        </TouchableOpacity>
      )}

      {showPasswordInput && (
        <TouchableOpacity
          style={[styles.primaryButton, { marginTop: 24 }]}
          onPress={handleSignUp}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="black" />
          ) : (
            <Text style={styles.primaryButtonText}>{t('auth.signUp')}</Text>
          )}
        </TouchableOpacity>
      )}
    </Animated.View>
  )

  const renderStep3 = () => (
    <Animated.View entering={FadeInRight} exiting={FadeOutLeft} style={styles.stepContent}>
      <View style={styles.iconCircle}>
        <Feather name="check" size={40} color="#1DB954" />
      </View>
      <Text style={styles.title}>{t('auth.checkInbox')}</Text>
      <Text style={styles.subtitle}>
        {t('auth.verificationSent')} {email.trim()}.
      </Text>

      <TouchableOpacity style={styles.primaryButton} onPress={() => router.replace('/login')}>
        <Text style={styles.primaryButtonText}>{t('auth.goToLogin')}</Text>
      </TouchableOpacity>
    </Animated.View>
  )

  return (
    <View style={styles.container}>
      {step > 1 && <StepIndicator totalSteps={3} currentStep={step} />}
      <GlassContainer style={styles.glass}>
        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}
      </GlassContainer>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  glass: {
    width: '100%',
    minHeight: 400,
    justifyContent: 'center',
  },
  stepContent: {
    width: '100%',
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 32,
    textAlign: 'center',
  },
  primaryButton: {
    backgroundColor: '#1DB954',
    width: '100%',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryButtonText: {
    color: 'black',
    fontWeight: 'bold',
    fontSize: 16,
  },
  secondaryButton: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    width: '100%',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
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
  },
  socialButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 15,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(29, 185, 84, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#1DB954',
  },
})
