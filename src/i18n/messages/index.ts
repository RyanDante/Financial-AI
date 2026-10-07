import agents from './agents';
import ai from './ai';
import common from './common';
import features from './features';
import forms from './forms';
import home from './home';
import money from './money';
import settings from './settings';
import setup from './setup';
import tabs from './tabs';
import transaction from './transaction';

/** Every message area. Add a new area file here. */
export const ALL_MESSAGES = [agents, ai, common, features, forms, home, money, settings, setup, tabs, transaction] as const;

type KeysOf<T> = T extends { en: infer E } ? Extract<keyof E, string> : never;
export type MessageKey = KeysOf<(typeof ALL_MESSAGES)[number]>;
