export const EVENT_PREFIX = 'EVENT_JSON:';

export enum EventStandards {
  NEP141 = 'nep141',
  NEP171 = 'nep171',
}

export enum NEP141Events {
  Mint = 'ft_mint',
  Transfer = 'ft_transfer',
  Burn = 'ft_burn',
}

export enum NEP171Events {
  Mint = 'nft_mint',
  Transfer = 'nft_transfer',
  Burn = 'nft_burn',
}

export interface UnknownEvent {
  [k: string]: unknown;
}

export interface EventBase extends UnknownEvent {
  standard: EventStandards;
  version: string;
  event: NEP141Events | NEP171Events;
  data: unknown;
}

export interface NEP141EventBase extends EventBase {
  standard: EventStandards.NEP141;
  version: string;
}

export interface NEP141EventMint extends NEP141EventBase {
  event: NEP141Events.Mint;
  data: { owner_id: string; amount: string; memo?: string | null }[];
}

export interface NEP141EventTransfer extends NEP141EventBase {
  event: NEP141Events.Transfer;
  data: {
    old_owner_id: string;
    new_owner_id: string;
    amount: string;
    memo?: string | null;
  }[];
}

export interface NEP141EventBurn extends NEP141EventBase {
  event: NEP141Events.Burn;
  data: {
    owner_id: string;
    amount: string;
    memo?: string | null;
  }[];
}

export interface NEP171EventBase extends EventBase {
  standard: EventStandards.NEP171;
  version: string;
}

export interface NEP171EventMint extends NEP171EventBase {
  event: NEP171Events.Mint;
  data: { owner_id: string; token_ids: string[]; memo?: string | null }[];
}

export interface NEP171EventTransfer extends NEP171EventBase {
  event: NEP171Events.Transfer;
  data: {
    authorized_id: string | null;
    old_owner_id: string;
    new_owner_id: string;
    token_ids: string[];
    memo?: string | null;
  }[];
}

export interface NEP171EventBurn extends NEP171EventBase {
  event: NEP171Events.Burn;
  data: {
    authorized_id: string | null;
    owner_id: string;
    token_ids: string[];
    memo?: string | null;
  }[];
}

export type NEP141Event =
  | NEP141EventMint
  | NEP141EventTransfer
  | NEP141EventBurn;

export type NEP171Event =
  | NEP171EventMint
  | NEP171EventTransfer
  | NEP171EventBurn;

export type Event = UnknownEvent | NEP141Event | NEP171Event;
