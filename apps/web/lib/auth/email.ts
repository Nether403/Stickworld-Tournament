import { authClient } from './client';

export async function signInWithEmail(email: string, password: string) {
  return authClient.signIn.email({ email, password, callbackURL: '/' });
}

export async function signUpWithEmail(email: string, password: string, name: string) {
  return authClient.signUp.email({ email, password, name, callbackURL: '/' });
}
