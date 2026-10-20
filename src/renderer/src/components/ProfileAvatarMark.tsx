import {
  Briefcase,
  FlaskConical,
  Ghost,
  Laptop,
  ShieldCheck,
  Star,
  User
} from 'lucide-react'
import type { ProfileAvatar } from '@shared/types'

export const PROFILE_AVATARS: { id: ProfileAvatar; icon: typeof User }[] = [
  { id: 'user', icon: User },
  { id: 'briefcase', icon: Briefcase },
  { id: 'laptop', icon: Laptop },
  { id: 'flask', icon: FlaskConical },
  { id: 'shield', icon: ShieldCheck },
  { id: 'ghost', icon: Ghost },
  { id: 'star', icon: Star }
]

export function ProfileAvatarMark({
  avatar,
  size = 16
}: {
  avatar?: ProfileAvatar
  size?: number
}) {
  const Icon = PROFILE_AVATARS.find((entry) => entry.id === avatar)?.icon ?? User
  return <Icon size={size} />
}
