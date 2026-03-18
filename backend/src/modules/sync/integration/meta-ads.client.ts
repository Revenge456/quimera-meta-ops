import {
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type MetaListResponse<T> = {
  data: T[];
  paging?: {
    next?: string;
  };
};

type MetaAdAccount = {
  id: string;
  account_id?: string;
  name: string;
  currency?: string;
  timezone_name?: string;
  account_status?: string | number;
  amount_spent?: string;
  business?: {
    id?: string;
    name?: string;
  };
};

type MetaCampaign = {
  id: string;
  name: string;
  objective?: string;
  buying_type?: string;
  daily_budget?: string;
  lifetime_budget?: string;
  effective_status?: string;
  configured_status?: string;
  start_time?: string;
  stop_time?: string;
  updated_time?: string;
};

type MetaAdSet = {
  id: string;
  name: string;
  optimization_goal?: string;
  billing_event?: string;
  bid_strategy?: string;
  targeting?: Record<string, unknown>;
  effective_status?: string;
  start_time?: string;
  stop_time?: string;
  updated_time?: string;
};

type MetaAd = {
  id: string;
  name: string;
  effective_status?: string;
  configured_status?: string;
  preview_shareable_link?: string;
  campaign?: { id: string };
  adset?: { id: string };
  creative?: { id: string };
  updated_time?: string;
};

type MetaCreative = {
  id: string;
  name?: string;
  body?: string;
  title?: string;
  call_to_action_type?: string;
  image_url?: string;
  thumbnail_url?: string;
  object_url?: string;
  asset_feed_spec?: Record<string, unknown>;
  object_story_spec?: Record<string, unknown>;
};

type MetaActionStat = {
  action_type: string;
  value: string;
};

export type MetaInsightRow = {
  date_start: string;
  spend?: string;
  impressions?: string;
  reach?: string;
  frequency?: string;
  clicks?: string;
  cpm?: string;
  cpc?: string;
  ctr?: string;
  actions?: MetaActionStat[];
  action_values?: MetaActionStat[];
  cost_per_action_type?: MetaActionStat[];
  purchase_roas?: MetaActionStat[];
  video_play_actions?: MetaActionStat[];
  video_p25_watched_actions?: MetaActionStat[];
  video_p50_watched_actions?: MetaActionStat[];
  video_p75_watched_actions?: MetaActionStat[];
  video_p100_watched_actions?: MetaActionStat[];
  thruplays?: MetaActionStat[];
  campaign_id?: string;
  adset_id?: string;
  ad_id?: string;
};

export type MetaAccessCredential = {
  accessToken: string;
  source: 'client_connection' | 'global_fallback';
  connectionId?: string;
};

@Injectable()
export class MetaAdsClient {
  private readonly baseUrl: string;
  private readonly fallbackAccessToken: string;

  constructor(private readonly configService: ConfigService) {
    const apiVersion =
      this.configService.get<string>('META_API_VERSION') ?? 'v22.0';
    this.fallbackAccessToken =
      this.configService.get<string>('META_ACCESS_TOKEN') ?? '';
    this.baseUrl = `https://graph.facebook.com/${apiVersion}`;
  }

  getGlobalFallbackCredential(): MetaAccessCredential | null {
    if (
      !this.fallbackAccessToken ||
      this.fallbackAccessToken === 'change-me'
    ) {
      return null;
    }

    return {
      accessToken: this.fallbackAccessToken,
      source: 'global_fallback',
    };
  }

  private ensureConfigured(accessToken: string) {
    if (!accessToken || accessToken === 'change-me') {
      throw new InternalServerErrorException(
        'No existe un access token de Meta utilizable',
      );
    }
  }

  private async request<T>(
    pathOrUrl: string,
    accessToken: string,
    params?: Record<string, string | number | undefined>,
    attempt = 1,
  ): Promise<T> {
    this.ensureConfigured(accessToken);

    const isAbsolute = pathOrUrl.startsWith('http');
    const url = new URL(isAbsolute ? pathOrUrl : `${this.baseUrl}/${pathOrUrl}`);

    if (!isAbsolute) {
      url.searchParams.set('access_token', accessToken);
      for (const [key, value] of Object.entries(params ?? {})) {
        if (value !== undefined && value !== null && value !== '') {
          url.searchParams.set(key, String(value));
        }
      }
    }

    const response = await fetch(url.toString());
    if (response.ok) {
      return (await response.json()) as T;
    }

    if (attempt < 3 && response.status >= 500) {
      await new Promise((resolve) => setTimeout(resolve, attempt * 500));
      return this.request<T>(pathOrUrl, accessToken, params, attempt + 1);
    }

    const errorBody = await response.text();
    throw new InternalServerErrorException(
      `Meta API error (${response.status}): ${errorBody}`,
    );
  }

  private async paginate<T>(
    path: string,
    accessToken: string,
    params?: Record<string, string | number | undefined>,
  ) {
    let nextPath: string | undefined = path;
    let nextParams = params;
    const rows: T[] = [];
    let apiCallsUsed = 0;

    while (nextPath) {
      const response: MetaListResponse<T> = await this.request<MetaListResponse<T>>(
        nextPath,
        accessToken,
        nextParams,
      );
      apiCallsUsed += 1;
      rows.push(...response.data);
      nextPath = response.paging?.next;
      nextParams = undefined;
    }

    return {
      rows,
      apiCallsUsed,
    };
  }

  async getConnectionIdentity(credential: MetaAccessCredential) {
    const row = await this.request<{ id: string; name?: string }>(
      'me',
      credential.accessToken,
      {
        fields: 'id,name',
      },
    );

    return {
      row,
      apiCallsUsed: 1,
    };
  }

  listAccessibleAdAccounts(credential: MetaAccessCredential) {
    return this.paginate<MetaAdAccount>('me/adaccounts', credential.accessToken, {
      fields:
        'id,account_id,name,currency,timezone_name,account_status,amount_spent,business{id,name}',
      limit: 100,
    });
  }

  async getAdAccount(metaAccountId: string, credential: MetaAccessCredential) {
    const fields = [
      'id',
      'account_id',
      'name',
      'currency',
      'timezone_name',
      'account_status',
      'amount_spent',
      'business{id,name}',
    ].join(',');

    const adAccount = await this.request<MetaAdAccount>(
      metaAccountId,
      credential.accessToken,
      {
        fields,
      },
    );

    return {
      row: adAccount,
      apiCallsUsed: 1,
    };
  }

  listCampaigns(
    metaAccountId: string,
    credential: MetaAccessCredential,
    updatedSince?: string,
  ) {
    return this.paginate<MetaCampaign>(
      `${metaAccountId}/campaigns`,
      credential.accessToken,
      {
      fields:
        'id,name,objective,buying_type,daily_budget,lifetime_budget,effective_status,configured_status,start_time,stop_time,updated_time',
      updated_since: updatedSince,
      limit: 100,
      },
    );
  }

  listAdSets(
    metaCampaignId: string,
    credential: MetaAccessCredential,
    updatedSince?: string,
  ) {
    return this.paginate<MetaAdSet>(
      `${metaCampaignId}/adsets`,
      credential.accessToken,
      {
      fields:
        'id,name,optimization_goal,billing_event,bid_strategy,targeting,effective_status,start_time,stop_time,updated_time',
      updated_since: updatedSince,
      limit: 100,
      },
    );
  }

  listAds(
    metaAccountId: string,
    credential: MetaAccessCredential,
    updatedSince?: string,
  ) {
    return this.paginate<MetaAd>(
      `${metaAccountId}/ads`,
      credential.accessToken,
      {
      fields:
        'id,name,effective_status,configured_status,preview_shareable_link,updated_time,campaign{id},adset{id},creative{id}',
      updated_since: updatedSince,
      limit: 100,
      },
    );
  }

  async getCreative(
    metaCreativeId: string,
    credential: MetaAccessCredential,
  ) {
    const fields = [
      'id',
      'name',
      'body',
      'title',
      'call_to_action_type',
      'image_url',
      'thumbnail_url',
      'object_url',
      'asset_feed_spec',
      'object_story_spec',
    ].join(',');

    const creative = await this.request<MetaCreative>(
      metaCreativeId,
      credential.accessToken,
      {
        fields,
      },
    );

    return {
      row: creative,
      apiCallsUsed: 1,
    };
  }

  listInsights(params: {
    metaAccountId: string;
    credential: MetaAccessCredential;
    level: 'campaign' | 'adset' | 'ad';
    since: string;
    until: string;
  }) {
    return this.paginate<MetaInsightRow>(
      `${params.metaAccountId}/insights`,
      params.credential.accessToken,
      {
        level: params.level,
        time_increment: 1,
        time_range: JSON.stringify({
          since: params.since,
          until: params.until,
        }),
        fields:
          'date_start,spend,impressions,reach,frequency,clicks,cpm,cpc,ctr,actions,action_values,cost_per_action_type,purchase_roas,video_play_actions,video_p25_watched_actions,video_p50_watched_actions,video_p75_watched_actions,video_p100_watched_actions,thruplays,campaign_id,adset_id,ad_id',
        limit: 500,
      },
    );
  }
}
