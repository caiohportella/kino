import { NativeTabs, Icon, Label, VectorIcon } from 'expo-router/unstable-native-tabs';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { DynamicColorIOS, Platform } from 'react-native';

export default function TabLayout() {
  return (
    <NativeTabs
      labelStyle={{
        color: DynamicColorIOS({
          dark: 'green',
          light: 'green'
        }),
      }}
      tintColor={
        DynamicColorIOS({
          dark: 'green',
          light: 'green'
        })}>
      <NativeTabs.Trigger name="index">
        <Label>Home</Label>
        {Platform.select({
          ios: <Icon sf="house.fill" />,
          android: <Icon src={<VectorIcon family={MaterialIcons} name="home" />} />,
        })}
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="search">
        <Label>Search</Label>
        {Platform.select({
          ios: <Icon sf="magnifyingglass" />,
          android: <Icon src={<VectorIcon family={MaterialIcons} name="search" />} />,
        })}
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="diary">
        <Label>Diary</Label>
        {Platform.select({
          ios: <Icon sf="book.fill" />,
          android: <Icon src={<VectorIcon family={MaterialIcons} name="book" />} />,
        })}
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="watchlists">
        <Label>Watchlists</Label>
        {Platform.select({
          ios: <Icon sf="list.bullet" />,
          android: <Icon src={<VectorIcon family={MaterialIcons} name="list" />} />,
        })}
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="profile">
        <Label>Profile</Label>
        {Platform.select({
          ios: <Icon sf="person.fill" />,
          android: <Icon src={<VectorIcon family={MaterialIcons} name="person" />} />,
        })}
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
