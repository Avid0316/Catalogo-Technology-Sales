exports.handler = async function(event) {

  const body = JSON.parse(event.body || "{}");

  const role = body.role;
  const password = body.password;

  const passwords = {
    mayorista: process.env.PASS_MAYORISTA,
    revendedor: process.env.PASS_REVENDEDOR,
    administracion: process.env.PASS_ADMIN
  };

  if (!passwords[role] || password !== passwords[role]) {
    return {
      statusCode: 401,
      body: JSON.stringify({
        error: "Contraseña incorrecta"
      })
    };
  }

  const response = await fetch(process.env.API_URL);
  const data = await response.json();

  return {
    statusCode: 200,
    body: JSON.stringify({
      success: true,
      role,
      data
    })
  };
};
