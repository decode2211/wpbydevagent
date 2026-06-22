
import axios from "axios";

const API_BASE = import.meta.env.DEV ? "http://localhost:8000" : "";

const apiClient = axios.create({
  baseURL: API_BASE,
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
  },
});

export default apiClient;
