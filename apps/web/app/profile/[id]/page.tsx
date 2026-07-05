import { ProfileView } from '@/components/profile-view'

export default async function PublicProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <ProfileView profileId={id} />
}
