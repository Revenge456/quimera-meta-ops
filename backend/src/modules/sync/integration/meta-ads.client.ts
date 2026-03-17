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

@Injectable()
export class MetaAdsClient {
  private readonly baseUrl: string;
  private readonly accessToken: string;

  constructor(private readonly configService: ConfigService) {
    const apiVersion =
      this.configService.get<string>('META_API_VERSION') ?? 'v22.0';
    this.accessToken =
      this.configService.get<string>('META_ACCESS_TOKEN') ?? '';
    this.baseUrl = `https://graph.facebook.com/${apiVersion}`;
  }

  private ensureConfigured() {
    if (!this.accessToken || this.accessToken === 'change-me') {
      throw new InternalServerErrorException(
        'META_ACCESS_TOKEN no configurado',
      );
    }
  }

  private async request<T>(
    pathOrUrl: string,
    params?: Record<string, string | number | undefined>,
    attempt = 1,
  ): Promise<T> {
    this.ensureConfigured();

    const isAbsolute = pathOrUrl.startsWith('http');
    const url = new URL(isAbsolute ? pathOrUrl : `${this.baseUrl}/${pathOrUrl}`);

    if (!isAbsolute) {
      url.searchParams.set('access_token', this.accessToken);
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
      return this.request<T>(pathOrUrl, params, attempt + 1);
    }

    const errorBody = await response.text();
    throw new InternalServerErrorException(
      `Meta API error (${response.status}): ${errorBody}`,
    );
  }

  private async paginate<T>(
    path: string,
    params?: Record<string, string | number | undefined>,
  ) {
    let nextPath: string | undefined = path;
    let nextParams = params;
    const rows: T[] = [];
    let apiCallsUsed = 0;

    while (nextPath) {
      const response: MetaListResponse<T> = await this.request<MetaListResponse<T>>(
        nextPath,
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

  async getAdAccount(metaAccountId: string) {
    const fields = [
      'id',
      'account_id',
      'name',
      'currency',
      'timezone_name',
      'account_status',
      'amount_spent',
    ].join(',');

    const adAccount = await this.request<MetaAdAccount>(metaAccountId, {
      fields,
    });

    return {
      row: adAccount,
      apiCallsUsed: 1,
    };
  }

  listCampaigns(metaAccountId: string, updatedSince?: string) {
    return this.paginate<MetaCampaign>(`${metaAccountId}/campaigns`, {
      fields:
        'id,name,objective,buying_type,daily_budget,lifetime_budget,effective_status,configured_status,start_time,stop_time,updated_time',
      updated_since: updatedSince,
      limit: 100,
    });
  }

  listAdSets(metaCampaignId: string, updatedSince?: string) {
    return this.paginate<MetaAdSet>(`${metaCampaignId}/adsets`, {
      fields:
        'id,name,optimization_goal,billing_event,bid_strategy,targeting,effective_status,start_time,stop_time,updated_time',
      updated_since: updatedSince,
      limit: 100,
    });
  }

  listAds(metaAccountId: string, updatedSince?: string) {
    return this.paginate<MetaAd>(`${metaAccountId}/ads`, {
      fields:
        'id,name,effective_status,configured_status,preview_shareable_link,updated_time,campaign{id},adset{id},creative{id}',
      updated_since: updatedSince,
      limit: 100,
    });
  }

  async getCreative(metaCreativeId: string) {
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

    const creative = await this.request<MetaCreative>(metaCreativeId, {
      fields,
    });

    return {
      row: creative,
      apiCallsUsed: 1,
    };
  }

  listInsights(params: {
    metaAccountId: string;
    level: 'campaign' | 'adset' | 'ad';
    since: string;
    until: string;
  }) {
    return this.paginate<MetaInsightRow>(`${params.metaAccountId}/insights`, {
      level: params.level,
      time_increment: 1,
      time_range: JSON.stringify({
        since: params.since,
        until: params.until,
      }),
      fields:
        'date_start,spend,impressions,reach,frequency,clicks,cpm,cpc,ctr,actions,action_values,cost_per_action_type,purchase_roas,video_play_actions,video_p25_watched_actions,video_p50_watched_actions,video_p75_watched_actions,video_p100_watched_actions,thruplays,campaign_id,adset_id,ad_id',
      limit: 500,
    });
  }
}
