import axios from "axios";

const getBaseURL = () => {
  if (window.location.hostname === "localhost") {
    return "http://localhost:8000";
  }
  return `http://${window.location.hostname}:8000`;
};

const api = axios.create({
  baseURL: getBaseURL(),
  headers: {
    "Content-Type": "application/json",
  },
});

export default api;
