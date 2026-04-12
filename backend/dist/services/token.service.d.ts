export declare const generateToken: () => Promise<string>;
export declare const validateToken: (token: string) => Promise<{
    valid: boolean;
    sessionId?: string;
    message?: string;
}>;
//# sourceMappingURL=token.service.d.ts.map