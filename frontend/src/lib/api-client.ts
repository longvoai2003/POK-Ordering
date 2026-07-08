export const API_BASE =
    process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";


export function apiUrl(path: string): string {
    if (path.startsWith("http://") || path.startsWith("https://")) return path;

    const base = API_BASE.replace(/\/$/, "");
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;

    return `${base}${normalizedPath}`;
}

export class ApiError extends Error {
    status: number;
    detail: unknown;

    constructor(status: number, detail: unknown) {
        super(`API error ${status}`);
        this.name = "ApiError";
        this.status = status;
        this.detail = detail;
    }

    getMessage(): string {
        if (typeof this.detail === "string") return this.detail;
        if (Array.isArray(this.detail)) {
            if (
                this.detail.length > 0 &&
                typeof this.detail[0] === "object" &&
                this.detail[0] !== null &&
                "msg" in this.detail[0]
            ) {
                return this.detail
                    .map((e: Record<string, unknown>) => String(e.msg))
                    .join("; ");
            }
            return this.detail.join("; ");
        }
        return "Something went wrong. Please try again.";
    }
}

export async function apiFetch<T>(
    path: string,
    init?: RequestInit,
): Promise<T> {
    const url = `${API_BASE}${path}`;
    console.log(url);
    const res = await fetch(url, {
        ...init,
        headers: {
            "Content-Type": "application/json",
            ...init?.headers,
        },
    });

    if (!res.ok) {
        let detail: unknown;
        try {
            detail = await res.json();
        } catch {
            detail = await res.text();
        }
        throw new ApiError(res.status, detail);
    }

    return res.json() as Promise<T>;
}
