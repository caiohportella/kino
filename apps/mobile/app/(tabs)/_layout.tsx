import { NativeTabs, Icon, VectorIcon, Label } from 'expo-router/unstable-native-tabs'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { DynamicColorIOS, Platform } from 'react-native'

export default function TabLayout() {
  const tintColor =
    Platform.OS === 'ios'
      ? DynamicColorIOS({
          dark: 'green',
          light: 'green',
        })
      : 'green'

  return (
    <NativeTabs
      tintColor={tintColor}
    >
      <NativeTabs.Trigger name="index">
        <Label>{""}</Label>
        {Platform.select({
          ios: <Icon sf="house.fill" />,
          android: <Icon src={<VectorIcon family={MaterialIcons} name="home" />} />,
        })}
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="search">
        <Label>{""}</Label>
        {Platform.select({
          ios: <Icon sf="magnifyingglass" />,
          android: <Icon src={<VectorIcon family={MaterialIcons} name="search" />} />,
        })}
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="diary">
        <Label>{""}</Label>
        {Platform.select({
          ios: <Icon sf="book.fill" />,
          android: <Icon src={<VectorIcon family={MaterialIcons} name="book" />} />,
        })}
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="watchlists">
        <Label>{""}</Label>
        {Platform.select({
          ios: <Icon sf="list.bullet" />,
          android: <Icon src={<VectorIcon family={MaterialIcons} name="list" />} />,
        })}
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="profile">
        <Label>{""}</Label>
        {Platform.select({
          ios: <Icon sf="person.fill" />,
          android: <Icon src={<VectorIcon family={MaterialIcons} name="person" />} />,
        })}
      </NativeTabs.Trigger>
    </NativeTabs>
  )
}
