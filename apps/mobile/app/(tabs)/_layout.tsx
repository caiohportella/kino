import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { hasAuthenticatedUser } from '@kino/core/auth'
import { Icon, Label, NativeTabs, VectorIcon } from 'expo-router/unstable-native-tabs'
import { DynamicColorIOS, Platform, View } from 'react-native'
import { Skeleton } from '~/components/common/Skeleton'
import { useAuth } from '~/hooks/useAuth'

export default function TabLayout() {
  const { resolution } = useAuth()
  const tintColor =
    Platform.OS === 'ios'
      ? DynamicColorIOS({
          dark: 'green',
          light: 'green',
        })
      : 'green'

  if (resolution.status === 'resolving' && !hasAuthenticatedUser(resolution)) {
    return (
      <View style={{ flex: 1, backgroundColor: '#121212' }}>
        <Skeleton layout="profile" />
      </View>
    )
  }

  return (
    <NativeTabs tintColor={tintColor}>
      <NativeTabs.Trigger name="index">
        <Label>{''}</Label>
        {Platform.select({
          ios: <Icon sf="house.fill" />,
          android: <Icon src={<VectorIcon family={MaterialIcons} name="home" />} />,
        })}
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="search">
        <Label>{''}</Label>
        {Platform.select({
          ios: <Icon sf="magnifyingglass" />,
          android: <Icon src={<VectorIcon family={MaterialIcons} name="search" />} />,
        })}
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="diary">
        <Label>{''}</Label>
        {Platform.select({
          ios: <Icon sf="book.fill" />,
          android: <Icon src={<VectorIcon family={MaterialIcons} name="book" />} />,
        })}
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="watchlists">
        <Label>{''}</Label>
        {Platform.select({
          ios: <Icon sf="list.bullet" />,
          android: <Icon src={<VectorIcon family={MaterialIcons} name="list" />} />,
        })}
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="profile">
        <Label>{''}</Label>
        {Platform.select({
          ios: <Icon sf="person.fill" />,
          android: <Icon src={<VectorIcon family={MaterialIcons} name="person" />} />,
        })}
      </NativeTabs.Trigger>
    </NativeTabs>
  )
}
