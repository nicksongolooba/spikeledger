export declare const PRODUCTION_ENDPOINT_HASHES: string[];
export declare function neonEndpointIds(connectionString: string): string[];
export declare function matchesEndpointHash(connectionString: string, hashes: string[]): boolean;
export declare function isProductionDatabase(connectionString: string): boolean;
export declare function productionRefusal(who: string, connectionString?: string): string | null;
export declare function refuseProductionDatabase(who?: string, connectionString?: string): void;
