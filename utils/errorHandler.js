function handleApiError(error, type = "GENERAL_ERROR") {
  console.error(`❌ ${type}:`, error.response?.statusText || error.message);

  const customError = new Error(
    error.response?.statusText ||
      "Something went wrong while processing your request."
  );

  customError.code = error.response?.status || 500;
  customError.type = type;
  customError.details = error.message;

  return customError;
}

module.exports = { handleApiError }; 
