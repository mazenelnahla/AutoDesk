import { Scopes } from '@aps_sdk/authentication';
import dotenv from 'dotenv';
dotenv.config();

let { APS_CLIENT_ID, APS_CLIENT_SECRET, APS_CALLBACK_URL, SERVER_SESSION_SECRET, PORT } = process.env;

if (!APS_CLIENT_ID || !APS_CLIENT_SECRET || !APS_CALLBACK_URL) {
  console.warn('Missing some of the environment variables (APS_CLIENT_ID, APS_CLIENT_SECRET, APS_CALLBACK_URL).');
}

SERVER_SESSION_SECRET = SERVER_SESSION_SECRET || 'aps_default_session_secret_12345';
PORT = PORT || 3001;

export const INTERNAL_TOKEN_SCOPES = [Scopes.DataRead, Scopes.ViewablesRead];
export const PUBLIC_TOKEN_SCOPES = [Scopes.ViewablesRead];

export {
  APS_CLIENT_ID,
  APS_CLIENT_SECRET,
  APS_CALLBACK_URL,
  SERVER_SESSION_SECRET,
  PORT
};
